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
    setTimeout(() => {
      FakeImage.inFlight--;
      this.onload?.();
    }, 0);
  }
}

describe('PageGridUploader', () => {
  let fixture: ComponentFixture<PageGridUploader>;
  let component: PageGridUploader;
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

    await TestBed.configureTestingModule({ imports: [PageGridUploader] }).compileComponents();
    fixture = TestBed.createComponent(PageGridUploader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const images = (n: number): File[] => Array.from({ length: n }, (_, i) => new File([`p${i}`], `p${i + 1}.png`, { type: 'image/png' }));
  const deleteButtons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button[aria-label="Delete page"]'));

  it('decodes dimensions with bounded concurrency, reusing one preview URL per page', async () => {
    await component.handleFiles(images(10));
    fixture.detectChanges();

    const pages = component.pages();
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
    await component.handleFiles(images(3));
    fixture.detectChanges();
    const before = component.pages();
    const third: PageUploadItem = before[2];

    deleteButtons()[1].click();
    fixture.detectChanges();

    expect(revoked).toEqual([before[1].previewUrl]);
    expect(component.pages().map((p) => [p.file.name, p.pageNumber])).toEqual([['p1.png', 1], ['p3.png', 2]]);
    expect(third.pageNumber).toBe(3);
  });

  it('revokes every preview URL on "Clear All"', async () => {
    await component.handleFiles(images(3));
    fixture.detectChanges();
    const urls = component.pages().map((p) => p.previewUrl);

    const clear = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('Clear All'))!;
    clear.click();
    fixture.detectChanges();

    expect(component.pages()).toEqual([]);
    expect(revoked).toEqual(urls);
  });

  it('revokes previews that finish decoding after the component is destroyed', async () => {
    const pending = component.handleFiles(images(2));
    fixture.destroy();
    await pending;

    expect(revoked.sort()).toEqual([...created].sort());
  });
});

describe('mapWithConcurrency', () => {
  it('keeps input order and never exceeds the limit', async () => {
    let inFlight = 0;
    let max = 0;
    const result = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
      inFlight++;
      max = Math.max(max, inFlight);
      await new Promise((r) => setTimeout(r, n));
      inFlight--;
      return n * 10;
    });
    expect(result).toEqual([50, 10, 40, 20, 30]);
    expect(max).toBe(2);
  });
});

describe('PageGridUploader error reporting', () => {
  it('tells the user which files were rejected and why', async () => {
    await TestBed.configureTestingModule({ imports: [PageGridUploader] }).compileComponents();
    const fixture = TestBed.createComponent(PageGridUploader);
    fixture.detectChanges();

    await fixture.componentInstance.handleFiles([
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
      new File(['not a zip'], 'broken.cbz', { type: 'application/zip' }),
    ]);
    fixture.detectChanges();

    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('"notes.txt" was skipped');
    expect(alert.textContent).toContain('"broken.cbz" is not a valid ZIP/CBZ archive');
    expect(fixture.componentInstance.pages()).toEqual([]);
  });
});
