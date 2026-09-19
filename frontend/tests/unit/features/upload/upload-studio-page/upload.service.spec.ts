import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { UploadService } from '@app/features/upload/upload-studio-page/upload.service';
import { ArchiveError, ArchiveLimits, PageUploadItem, naturalCompare, sortFilesNaturally, extractArchiveImages } from '@app/features/upload/upload-studio-page/file-utils';
import { StorageUploadResult } from '@app/core/models/chapter';
import JSZip from 'jszip';
import { API, fail, ok, provideHttpTesting } from '../../../test-utils';

/** How the storage endpoint answers one page upload. */
type StorageAnswer = StorageUploadResult | { rejectedWith: string };

async function archive(files: Record<string, string | Uint8Array>, name: string, options: { type: string; compression: 'STORE' | 'DEFLATE' }): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: options.compression });
  return new File([blob], name, { type: options.type });
}

describe('UploadService and file-utils', () => {
  let service: UploadService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...provideHttpTesting()],
    });
    service = TestBed.inject(UploadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('file-utils', () => {
    let sortedNames: string[];
    let archiveFile: File;
    let extracted: File[];

    it('sorts filenames naturally (e.g., 1.jpg, 2.jpg, 10.jpg, page_02.png)', () => {
      whenISortTheNames(['p10.png', 'p1.png', 'p2.png', 'p20.png', 'p11.png']);

      thenTheOrderIs(['p1.png', 'p2.png', 'p10.png', 'p11.png', 'p20.png']);

      whenISortFilesNamed(['p10.png', 'p1.png', 'p2.png', 'p20.png', 'p11.png']);

      thenTheOrderIs(['p1.png', 'p2.png', 'p10.png', 'p11.png', 'p20.png']);
    });

    it('extracts images from a zip archive in natural order', async () => {
      await givenTheArchive('chapter1.cbz', { 'p2.jpg': 'img2', 'p1.jpg': 'img1', 'p10.jpg': 'img10', 'readme.txt': 'not an image' });

      await whenIExtractTheImages();

      thenIGetImages(3);
      thenTheExtractedImagesAre(['p1.jpg', 'p2.jpg', 'p10.jpg']);
    });

    async function givenTheArchive(name: string, files: Record<string, string>): Promise<void> {
      archiveFile = await archive(files, name, { type: 'application/x-cbz', compression: 'STORE' });
    }

    function whenISortTheNames(names: string[]): void {
      sortedNames = [...names].sort(naturalCompare);
    }

    function whenISortFilesNamed(names: string[]): void {
      sortedNames = sortFilesNaturally(names.map((n) => new File(['content'], n, { type: 'image/png' }))).map((f) => f.name);
    }

    async function whenIExtractTheImages(): Promise<void> {
      extracted = await extractArchiveImages(archiveFile);
    }

    function thenTheOrderIs(names: string[]): void {
      expect(sortedNames).toEqual(names);
    }

    function thenIGetImages(count: number): void {
      expect(extracted.length).toBe(count);
    }

    function thenTheExtractedImagesAre(names: string[]): void {
      expect(extracted.map((f) => f.name)).toEqual(names);
    }
  });

  describe('UploadService', () => {
    let lastRequest: TestRequest;
    let cover: StorageUploadResult;
    let pages: PageUploadItem[];
    let pagesBefore: Omit<PageUploadItem, 'file'>[];
    let inFlightAtOnce: number;
    let progress: number[];
    let settledPages: PageUploadItem[];
    let results: PageUploadItem[];

    it('uploadCover sends multipart form to /storage/upload?folder=covers', async () => {
      await whenIUploadTheCover('cover.jpg', { storageKey: 'covers/uuid-cover.jpg', cdnUrl: 'https://cdn.readora.com/covers/uuid-cover.jpg' });

      thenTheRequestWasAPost();
      thenTheCoverIsStoredAs({ storageKey: 'covers/uuid-cover.jpg', cdnUrl: 'https://cdn.readora.com/covers/uuid-cover.jpg' });
    });

    it('uploadPagesBatch uploads all pages with progress notifications', async () => {
      givenThePages(pendingPage(1, '01.png'), pendingPage(2, '02.png'));

      await whenIUploadThePages({ folder: 'scans/c1', concurrency: 2 }, [
        { storageKey: 'scans/c1/p1.png', cdnUrl: 'https://cdn.readora.com/scans/c1/p1.png' },
        { storageKey: 'scans/c1/p2.png', cdnUrl: 'https://cdn.readora.com/scans/c1/p2.png' }
      ]);

      thenUploadsRanAtOnce(2);
      thenIGetResults(2);
      thenPageStatusIs(1, 'done');
      thenPageIsStoredAs(1, 'scans/c1/p1.png');
      thenPageIsStoredAs(2, 'scans/c1/p2.png');
      thenProgressWasReported([1, 2]);
    });

    it('uploadPagesBatch marks failed pages as error without failing the batch or mutating inputs', async () => {
      givenThePages(pendingPage(1, '01.png'), pendingPage(2, '02.png'));

      await whenIUploadThePages({ folder: 'scans/c1', concurrency: 2 }, [
        { storageKey: 'k1', cdnUrl: 'https://cdn/k1' },
        { rejectedWith: 'File too large' }
      ]);

      thenThePageStatusesAre(['done', 'error']);
      thenPageErrorIs(2, 'File too large');
      thenPagesWereReportedAsSettled(2);
      thenTheInputPagesAreUnchanged();
      thenTheResultsAreNewObjects();
    });

    it('uploadPagesBatch skips pages that are already uploaded (retry)', async () => {
      givenThePages(
        { ...pendingPage(1, '01.png'), status: 'done', progress: 100, storageKey: 'k1', cdnUrl: 'https://cdn/k1' },
        { ...pendingPage(2, '02.png'), status: 'error', error: 'boom' }
      );

      await whenIRetryTheUpload('scans/c1', { storageKey: 'k2', cdnUrl: 'https://cdn/k2' });

      thenTheResultsAre([
        ['done', 'k1', undefined],
        ['done', 'k2', undefined],
      ]);
    });

    function givenThePages(...items: PageUploadItem[]): void {
      pages = items;
      pagesBefore = structuredClone(items.map(({ file: _f, ...rest }) => rest));
    }

    async function whenIUploadTheCover(fileName: string, storedAs: StorageUploadResult): Promise<void> {
      const upload = firstValueFrom(service.uploadCover(new File(['cover-data'], fileName, { type: 'image/jpeg' })));
      lastRequest = http.expectOne(`${API}/storage/upload?folder=covers`);
      lastRequest.flush(ok(storedAs));
      cover = await upload;
    }

    async function whenIUploadThePages(options: { folder: string; concurrency: number }, answers: StorageAnswer[]): Promise<void> {
      progress = [];
      settledPages = [];
      const batch = firstValueFrom(
        service.uploadPagesBatch(pages, options.folder, options.concurrency, (completed, _total, item) => {
          progress.push(completed);
          settledPages.push(item);
        })
      );
      const requests = http.match((r) => r.url.includes('/storage/upload'));
      inFlightAtOnce = requests.length;
      requests.forEach((request, i) => answer(request, answers[i]));
      results = await batch;
    }

    async function whenIRetryTheUpload(folder: string, storedAs: StorageUploadResult): Promise<void> {
      const batch = firstValueFrom(service.uploadPagesBatch(pages, folder));
      answer(http.expectOne((r) => r.url.includes('/storage/upload')), storedAs);
      results = await batch;
    }

    function thenTheRequestWasAPost(): void {
      expect(lastRequest.request.method).toBe('POST');
    }

    function thenTheCoverIsStoredAs(stored: StorageUploadResult): void {
      expect(cover.storageKey).toBe(stored.storageKey);
      expect(cover.cdnUrl).toBe(stored.cdnUrl);
    }

    function thenUploadsRanAtOnce(count: number): void {
      expect(inFlightAtOnce).toBe(count);
    }

    function thenIGetResults(count: number): void {
      expect(results.length).toBe(count);
    }

    function thenPageStatusIs(pageNumber: number, status: PageUploadItem['status']): void {
      expect(results[pageNumber - 1].status).toBe(status);
    }

    function thenThePageStatusesAre(statuses: PageUploadItem['status'][]): void {
      expect(results.map((r) => r.status)).toEqual(statuses);
    }

    function thenPageIsStoredAs(pageNumber: number, storageKey: string): void {
      expect(results[pageNumber - 1].storageKey).toBe(storageKey);
    }

    function thenPageErrorIs(pageNumber: number, error: string): void {
      expect(results[pageNumber - 1].error).toBe(error);
    }

    function thenProgressWasReported(completedCounts: number[]): void {
      expect(progress).toEqual(completedCounts);
    }

    function thenPagesWereReportedAsSettled(count: number): void {
      expect(settledPages.length).toBe(count);
    }

    function thenTheInputPagesAreUnchanged(): void {
      expect(pages.map(({ file: _f, ...rest }) => rest)).toEqual(pagesBefore);
    }

    function thenTheResultsAreNewObjects(): void {
      expect(results[0]).not.toBe(pages[0]);
    }

    function thenTheResultsAre(rows: [PageUploadItem['status'], string | undefined, string | undefined][]): void {
      expect(results.map((r) => [r.status, r.storageKey, r.error])).toEqual(rows);
    }

    function pendingPage(pageNumber: number, fileName: string): PageUploadItem {
      return { id: String(pageNumber), file: new File([`p${pageNumber}`], fileName, { type: 'image/png' }), previewUrl: '', pageNumber, status: 'pending', progress: 0 };
    }

    function answer(request: TestRequest, response: StorageAnswer): void {
      if ('rejectedWith' in response) {
        request.flush(fail(response.rejectedWith), { status: 413, statusText: 'Payload Too Large' });
      } else {
        request.flush(ok(response));
      }
    }
  });
});

describe('extractArchiveImages limits (zip-bomb guards)', () => {
  const LIMITS: ArchiveLimits = {
    maxArchiveBytes: 1024 * 1024,
    maxImageEntries: 3,
    maxTotalEntries: 5,
    maxEntryBytes: 1000,
    maxTotalUncompressedBytes: 2500,
  };

  let archiveFile: File;
  let extraction: Promise<File[]>;
  let loadSpy: ReturnType<typeof vi.spyOn>;

  it('rejects an archive file above the size limit before reading it', async () => {
    givenArchiveReadsAreRecorded();
    givenTheFile('huge.cbz', new Uint8Array(LIMITS.maxArchiveBytes + 1));

    whenIExtractTheImages();

    await thenExtractionFailsWith(/huge\.cbz" is larger than/);
    thenTheArchiveWasNotRead();
  });

  it('rejects too many entries', async () => {
    await givenTheArchive({ '1.png': 'a', '2.png': 'b', '3.png': 'c', '4.png': 'd' });

    whenIExtractTheImages();

    await thenExtractionFailsWithAnArchiveError();
    await thenExtractionFailsWith(/too many files/);
  });

  it('rejects an entry whose declared uncompressed size is too big', async () => {
    await givenTheArchive({ '1.png': new Uint8Array(5000) });

    whenIExtractTheImages();

    await thenExtractionFailsWith(/1\.png" is larger than/);

    await givenTheArchive({ '1.png': new Uint8Array(900), '2.png': new Uint8Array(900), '3.png': new Uint8Array(900) });

    whenIExtractTheImages();

    await thenExtractionFailsWith(/ch\.cbz" is larger than 0 MB once unpacked/);
  });

  it('stops inflating when an entry lies about its size (zip bomb)', async () => {
    givenEveryEntryClaimsToBeOneByte();
    // Small lies are caught by JSZip's own size check at the end of the entry...
    await givenTheArchive({ '1.png': new Uint8Array(900) });

    whenIExtractTheImages();

    await thenExtractionFailsWithAnArchiveError();

    // ...big ones are cut off by the byte counter as soon as the limit is crossed.
    await givenTheArchive({ 'bomb.png': new Uint8Array(200_000) });

    whenIExtractTheImages();

    await thenExtractionFailsWith(/bomb\.png" is larger than/);
  });

  it('reports invalid archives and archives without images', async () => {
    givenTheFile('bad.zip', 'not a zip');

    whenIExtractTheImages();

    await thenExtractionFailsWith(/not a valid ZIP/);

    await givenTheArchive({ 'readme.txt': 'hello' });

    whenIExtractTheImages();

    await thenExtractionFailsWith(/does not contain any/);
  });

  it('extracts within the limits', async () => {
    await givenTheArchive({ 'b/2.png': new Uint8Array(800), 'b/1.png': new Uint8Array(800) });

    whenIExtractTheImages();

    await thenTheExtractedPagesAre([
      ['1.png', 800, 'image/png'],
      ['2.png', 800, 'image/png'],
    ]);
  });

  function givenArchiveReadsAreRecorded(): void {
    loadSpy = vi.spyOn(JSZip.prototype, 'loadAsync');
  }

  function givenEveryEntryClaimsToBeOneByte(): void {
    const realLoad = JSZip.prototype.loadAsync;
    vi.spyOn(JSZip.prototype, 'loadAsync').mockImplementation(async function (this: JSZip, data: any) {
      const zip = await realLoad.call(this, data);
      zip.forEach((_path, entry) => ((entry as any)._data.uncompressedSize = 1));
      return zip;
    });
  }

  function givenTheFile(name: string, content: BlobPart): void {
    archiveFile = new File([content], name);
  }

  async function givenTheArchive(files: Record<string, string | Uint8Array>): Promise<void> {
    archiveFile = await archive(files, 'ch.cbz', { type: 'application/zip', compression: 'DEFLATE' });
  }

  function whenIExtractTheImages(): void {
    extraction = extractArchiveImages(archiveFile, LIMITS);
    // Marks the rejection as handled until a then… awaits it.
    extraction.catch(() => undefined);
  }

  async function thenExtractionFailsWith(message: RegExp): Promise<void> {
    await expect(extraction).rejects.toThrow(message);
  }

  async function thenExtractionFailsWithAnArchiveError(): Promise<void> {
    await expect(extraction).rejects.toBeInstanceOf(ArchiveError);
  }

  function thenTheArchiveWasNotRead(): void {
    expect(loadSpy).not.toHaveBeenCalled();
  }

  async function thenTheExtractedPagesAre(pages: [string, number, string][]): Promise<void> {
    expect((await extraction).map((p) => [p.name, p.size, p.type])).toEqual(pages);
  }
});
