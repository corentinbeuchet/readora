import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IMAGE_DECODE_CONCURRENCY, PageGridUploader } from '@app/features/upload/components/page-grid-uploader';
import { PageUploadItem, mapWithConcurrency } from '@app/features/upload/services/file-utils';

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
  let pagesBefore: PageUploadItem[];

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

  it('decodes dimensions with bounded concurrency, reusing one preview URL per page', async () => {
    await whenIAddImages(10);

    thenIHavePages(10);
    thenThePagesAreNumbered([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    thenEveryPageMeasures(800, 1200);
    thenSeveralImagesWereDecodedAtOnce();
    thenNoMoreImagesWereDecodedAtOnceThan(IMAGE_DECODE_CONCURRENCY);
    thenObjectUrlsWereCreated(10);
    thenTheDecodedImagesAreThePreviews();
    thenNoPreviewUrlWasRevoked();
  });

  it('revokes the preview URL of a removed page and renumbers without mutating', async () => {
    await givenIAddedImages(3);

    whenIDeletePage(2);

    thenOnlyThePreviewOfOriginalPageWasRevoked(2);
    thenThePagesAre([['p1.png', 1], ['p3.png', 2]]);
    thenOriginalPageStillHasNumber(3, 3);
  });

  it('keeps an optional description per page for screen readers (US-07)', async () => {
    await givenIAddedImages(2);

    thenTheDescriptionFieldOfPageReads(2, 'Description of page 2');

    whenIDescribePage(2, 'A storm over the city');

    thenTheDescriptionsAre([undefined, 'A storm over the city']);
    thenOriginalPageHasNoDescription(2);
  });

  it('revokes every preview URL on "Clear All"', async () => {
    await givenIAddedImages(3);

    whenIClearAll();

    thenThereAreNoPages();
    thenEveryOriginalPreviewWasRevoked();
  });

  it('revokes previews that finish decoding after the component is destroyed', async () => {
    givenIChoseImages(2);

    await whenTheUploaderIsDestroyedBeforeTheDecodesFinish();

    thenEveryCreatedPreviewUrlWasRevoked();
  });

  async function givenIAddedImages(count: number): Promise<void> {
    await whenIAddImages(count);
    pagesBefore = host.pages();
  }

  function givenIChoseImages(count: number): void {
    choose(fixture, images(count));
  }

  async function whenIAddImages(count: number): Promise<void> {
    choose(fixture, images(count));
    await settleDecodes(fixture);
  }

  function whenIDeletePage(pageNumber: number): void {
    deleteButtons()[pageNumber - 1].click();
    fixture.detectChanges();
  }

  function whenIDescribePage(pageNumber: number, description: string): void {
    const field = descriptions()[pageNumber - 1].querySelector('textarea')!;
    field.value = description;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function whenIClearAll(): void {
    Array.from(page().querySelectorAll('button')).find((b) => b.textContent?.includes('Clear All'))!.click();
    fixture.detectChanges();
  }

  async function whenTheUploaderIsDestroyedBeforeTheDecodesFinish(): Promise<void> {
    fixture.destroy();
    await settleDecodes(fixture);
  }

  function thenIHavePages(count: number): void {
    expect(host.pages().length).toBe(count);
  }

  function thenThePagesAreNumbered(pageNumbers: number[]): void {
    expect(host.pages().map((p) => p.pageNumber)).toEqual(pageNumbers);
  }

  function thenEveryPageMeasures(width: number, height: number): void {
    expect(host.pages().every((p) => p.width === width && p.height === height)).toBe(true);
  }

  function thenSeveralImagesWereDecodedAtOnce(): void {
    expect(FakeImage.maxInFlight).toBeGreaterThan(1);
  }

  function thenNoMoreImagesWereDecodedAtOnceThan(limit: number): void {
    expect(FakeImage.maxInFlight).toBeLessThanOrEqual(limit);
  }

  /** One per page: no extra object URL just to read dimensions. */
  function thenObjectUrlsWereCreated(count: number): void {
    expect(created.length).toBe(count);
  }

  function thenTheDecodedImagesAreThePreviews(): void {
    expect(FakeImage.srcs).toEqual(host.pages().map((p) => p.previewUrl));
  }

  function thenNoPreviewUrlWasRevoked(): void {
    expect(revoked).toEqual([]);
  }

  function thenOnlyThePreviewOfOriginalPageWasRevoked(pageNumber: number): void {
    expect(revoked).toEqual([pagesBefore[pageNumber - 1].previewUrl]);
  }

  function thenThePagesAre(pages: [string, number][]): void {
    expect(host.pages().map((p) => [p.file.name, p.pageNumber])).toEqual(pages);
  }

  function thenOriginalPageStillHasNumber(originalPageNumber: number, pageNumber: number): void {
    expect(pagesBefore[originalPageNumber - 1].pageNumber).toBe(pageNumber);
  }

  function thenTheDescriptionFieldOfPageReads(pageNumber: number, label: string): void {
    expect(descriptions()[pageNumber - 1].textContent).toContain(label);
  }

  function thenTheDescriptionsAre(descriptionsByPage: (string | undefined)[]): void {
    expect(host.pages().map((p) => p.description)).toEqual(descriptionsByPage);
  }

  function thenOriginalPageHasNoDescription(pageNumber: number): void {
    expect(pagesBefore[pageNumber - 1].description).toBeUndefined();
  }

  function thenThereAreNoPages(): void {
    expect(host.pages()).toEqual([]);
  }

  function thenEveryOriginalPreviewWasRevoked(): void {
    expect(revoked).toEqual(pagesBefore.map((p) => p.previewUrl));
  }

  function thenEveryCreatedPreviewUrlWasRevoked(): void {
    expect(revoked.sort()).toEqual([...created].sort());
  }

  function images(count: number): File[] {
    return Array.from({ length: count }, (_, i) => new File([`p${i}`], `p${i + 1}.png`, { type: 'image/png' }));
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function deleteButtons(): HTMLButtonElement[] {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('button[aria-label="Delete page"]'));
  }

  function descriptions(): HTMLElement[] {
    return Array.from(page().querySelectorAll<HTMLElement>('.page-description'));
  }
});

describe('mapWithConcurrency', () => {
  let inFlight: number;
  let mostAtOnce: number;
  let results: number[];

  beforeEach(() => vi.useFakeTimers());

  afterEach(() => vi.useRealTimers());

  it('keeps input order and never exceeds the limit', async () => {
    await whenIMapTimesTenWithALimitOf([5, 1, 4, 2, 3], 2);

    thenTheResultsAre([50, 10, 40, 20, 30]);
    thenTheMostRunningAtOnceWas(2);
  });

  /** Each value `n` takes `n` ms, so the calls finish out of order. */
  async function whenIMapTimesTenWithALimitOf(values: number[], limit: number): Promise<void> {
    inFlight = 0;
    mostAtOnce = 0;
    const pending = mapWithConcurrency(values, limit, async (n) => {
      inFlight++;
      mostAtOnce = Math.max(mostAtOnce, inFlight);
      await new Promise((r) => setTimeout(r, n));
      inFlight--;
      return n * 10;
    });
    await vi.runAllTimersAsync();
    results = await pending;
  }

  function thenTheResultsAre(expected: number[]): void {
    expect(results).toEqual(expected);
  }

  function thenTheMostRunningAtOnceWas(count: number): void {
    expect(mostAtOnce).toBe(count);
  }
});

describe('PageGridUploader error reporting', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('tells the user which files were rejected and why', async () => {
    await whenIChoose(new File(['x'], 'notes.txt', { type: 'text/plain' }), new File(['not a zip'], 'broken.cbz', { type: 'application/zip' }));

    thenTheAlertSays('"notes.txt" was skipped');
    thenTheAlertSays('"broken.cbz" is not a valid ZIP/CBZ archive');
    thenNoPageWasAdded();
  });

  async function whenIChoose(...files: File[]): Promise<void> {
    choose(fixture, files);
    await fixture.whenStable();
    await settleDecodes(fixture);
  }

  function thenTheAlertSays(text: string): void {
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')!.textContent).toContain(text);
  }

  function thenNoPageWasAdded(): void {
    expect(fixture.componentInstance.pages()).toEqual([]);
  }
});
