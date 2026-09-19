import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IMAGE_DECODE_CONCURRENCY, PageGridUploader } from '@app/features/upload/components/page-grid-uploader';
import { PageUploadItem, mapWithConcurrency } from '@app/core/upload/file-utils';

/** Image double: "decodes" asynchronously and records how many decodes run at once. */
class FakeImage {
  static inFlight = 0;
  static maxInFlight = 0;
  static srcs: string[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 1200;
  width = 0;
  height = 0;
  set src(value: string) {
    FakeImage.srcs.push(value);
    FakeImage.inFlight++;
    FakeImage.maxInFlight = Math.max(FakeImage.maxInFlight, FakeImage.inFlight);
    queueMicrotask(() => {
      FakeImage.inFlight--;
      this.onload?.();
    });
  }
}

/** Binds the uploader like the upload studio does: `[(pages)]` is its public API. */
@Component({ imports: [PageGridUploader], template: `<app-page-grid-uploader [(pages)]="pages" />` })
class Host {
  readonly pages = signal<PageUploadItem[]>([]);
}

/** Selects files through the uploader's file input, as the user does. */
function choose(fixture: ComponentFixture<unknown>, files: File[]): void {
  const input = (fixture.nativeElement as HTMLElement).querySelector('app-page-grid-uploader input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change'));
}

async function settleDecodes(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
  fixture.detectChanges();
}

describe('PageGridUploader', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let created: string[];
  let revoked: string[];

  beforeEach(async () => {
    created = [];
    revoked = [];
    FakeImage.inFlight = 0;
    FakeImage.maxInFlight = 0;
    FakeImage.srcs = [];
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test/${created.length + 1}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => void revoked.push(url));

    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  async function add(files: File[]): Promise<void> {
    choose(fixture, files);
    await settleDecodes(fixture);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const images = (n: number): File[] => Array.from({ length: n }, (_, i) => new File([`p${i}`], `p${i + 1}.png`, { type: 'image/png' }));
  const deleteButtons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button[aria-label="Delete page"]'));

  it('decodes dimensions with bounded concurrency, reusing one preview URL per page', async () => {
    await add(images(10));

    const pages = host.pages();
    expect(pages.length).toBe(10);
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(pages.every((p) => p.width === 800 && p.height === 1200)).toBe(true);
    expect(FakeImage.maxInFlight).toBeGreaterThan(1);
    expect(FakeImage.maxInFlight).toBeLessThanOrEqual(IMAGE_DECODE_CONCURRENCY);
    // No extra object URL just to read dimensions.
    expect(created.length).toBe(10);
    expect(FakeImage.srcs).toEqual(pages.map((p) => p.previewUrl));
    expect(revoked).toEqual([]);
  });

  it('revokes the preview URL of a removed page and renumbers without mutating', async () => {
    await add(images(3));
    const before = host.pages();
    const third: PageUploadItem = before[2];

    deleteButtons()[1].click();
    fixture.detectChanges();

    expect(revoked).toEqual([before[1].previewUrl]);
    expect(host.pages().map((p) => [p.file.name, p.pageNumber])).toEqual([['p1.png', 1], ['p3.png', 2]]);
    expect(third.pageNumber).toBe(3);
  });

  it('keeps an optional description per page for screen readers (US-07)', async () => {
    await add(images(2));
    const before = host.pages();
    const field: HTMLTextAreaElement = fixture.nativeElement.querySelectorAll('.page-description textarea')[1];
    expect(fixture.nativeElement.querySelectorAll('.page-description')[1].textContent).toContain('Description of page 2');

    field.value = 'A storm over the city';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.pages().map((p) => p.description)).toEqual([undefined, 'A storm over the city']);
    expect(before[1].description).toBeUndefined();
  });

  it('revokes every preview URL on "Clear All"', async () => {
    await add(images(3));
    const urls = host.pages().map((p) => p.previewUrl);

    const clear = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('Clear All'))!;
    clear.click();
    fixture.detectChanges();

    expect(host.pages()).toEqual([]);
    expect(revoked).toEqual(urls);
  });

  it('revokes previews that finish decoding after the component is destroyed', async () => {
    choose(fixture, images(2));
    fixture.destroy();
    await settleDecodes(fixture);

    expect(revoked.sort()).toEqual([...created].sort());
  });
});

describe('mapWithConcurrency', () => {
  it('keeps input order and never exceeds the limit', async () => {
    vi.useFakeTimers();
    try {
      let inFlight = 0;
      let max = 0;
      const pending = mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
        inFlight++;
        max = Math.max(max, inFlight);
        await new Promise((r) => setTimeout(r, n));
        inFlight--;
        return n * 10;
      });
      await vi.runAllTimersAsync();
      expect(await pending).toEqual([50, 10, 40, 20, 30]);
      expect(max).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('PageGridUploader error reporting', () => {
  it('tells the user which files were rejected and why', async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    choose(fixture, [
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
      new File(['not a zip'], 'broken.cbz', { type: 'application/zip' }),
    ]);
    await fixture.whenStable();
    await settleDecodes(fixture);

    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('"notes.txt" was skipped');
    expect(alert.textContent).toContain('"broken.cbz" is not a valid ZIP/CBZ archive');
    expect(fixture.componentInstance.pages()).toEqual([]);
  });
});
