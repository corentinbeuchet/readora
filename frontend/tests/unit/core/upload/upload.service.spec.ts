import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { UploadService } from '@app/core/upload/upload.service';
import { PageUploadItem, naturalCompare, sortFilesNaturally, extractArchiveImages } from '@app/core/upload/file-utils';
import { environment } from '../../../../src/environments/environment';
import JSZip from 'jszip';

const API = environment.apiUrl;

describe('UploadService and file-utils', () => {
  let service: UploadService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UploadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('file-utils', () => {
    it('sorts filenames naturally (e.g., 1.jpg, 2.jpg, 10.jpg, page_02.png)', () => {
      const names = ['p10.png', 'p1.png', 'p2.png', 'p20.png', 'p11.png'];
      const sorted = [...names].sort(naturalCompare);
      expect(sorted).toEqual(['p1.png', 'p2.png', 'p10.png', 'p11.png', 'p20.png']);

      const files = names.map((n) => new File(['content'], n, { type: 'image/png' }));
      const sortedFiles = sortFilesNaturally(files);
      expect(sortedFiles.map((f) => f.name)).toEqual(['p1.png', 'p2.png', 'p10.png', 'p11.png', 'p20.png']);
    });

    it('extracts images from a zip archive in natural order', async () => {
      const zip = new JSZip();
      zip.file('p2.jpg', 'img2');
      zip.file('p1.jpg', 'img1');
      zip.file('p10.jpg', 'img10');
      zip.file('readme.txt', 'not an image');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([zipBlob], 'chapter1.cbz', { type: 'application/x-cbz' });

      const extracted = await extractArchiveImages(zipFile);
      expect(extracted.length).toBe(3);
      expect(extracted.map((f) => f.name)).toEqual(['p1.jpg', 'p2.jpg', 'p10.jpg']);
    });
  });

  describe('UploadService', () => {
    it('uploadCover sends multipart form to /storage/upload?folder=covers', async () => {
      const coverFile = new File(['cover-data'], 'cover.jpg', { type: 'image/jpeg' });
      const upload$ = firstValueFrom(service.uploadCover(coverFile));

      const req = http.expectOne(`${API}/storage/upload?folder=covers`);
      expect(req.request.method).toBe('POST');
      req.flush({
        success: true,
        data: {
          storageKey: 'covers/uuid-cover.jpg',
          cdnUrl: 'https://cdn.readora.com/covers/uuid-cover.jpg',
        },
        error: null,
      });

      const res = await upload$;
      expect(res.storageKey).toBe('covers/uuid-cover.jpg');
      expect(res.cdnUrl).toBe('https://cdn.readora.com/covers/uuid-cover.jpg');
    });

    it('uploadPagesBatch uploads all pages with progress notifications', async () => {
      const p1 = new File(['p1'], '01.png', { type: 'image/png' });
      const p2 = new File(['p2'], '02.png', { type: 'image/png' });

      const items: PageUploadItem[] = [
        { id: '1', file: p1, previewUrl: '', pageNumber: 1, status: 'pending', progress: 0 },
        { id: '2', file: p2, previewUrl: '', pageNumber: 2, status: 'pending', progress: 0 },
      ];

      const progressUpdates: number[] = [];
      const batch$ = firstValueFrom(
        service.uploadPagesBatch(items, 'scans/c1', 2, (completed) => progressUpdates.push(completed))
      );

      const reqs = http.match((r) => r.url.includes('/storage/upload'));
      expect(reqs.length).toBe(2);

      reqs[0].flush({
        success: true,
        data: { storageKey: 'scans/c1/p1.png', cdnUrl: 'https://cdn.readora.com/scans/c1/p1.png' },
        error: null,
      });
      reqs[1].flush({
        success: true,
        data: { storageKey: 'scans/c1/p2.png', cdnUrl: 'https://cdn.readora.com/scans/c1/p2.png' },
        error: null,
      });

      const results = await batch$;
      expect(results.length).toBe(2);
      expect(results[0].status).toBe('done');
      expect(results[0].storageKey).toBe('scans/c1/p1.png');
      expect(results[1].storageKey).toBe('scans/c1/p2.png');
      expect(progressUpdates).toEqual([1, 2]);
    });

    it('uploadPagesBatch marks failed pages as error without failing the batch or mutating inputs', async () => {
      const items: PageUploadItem[] = [
        { id: '1', file: new File(['p1'], '01.png', { type: 'image/png' }), previewUrl: '', pageNumber: 1, status: 'pending', progress: 0 },
        { id: '2', file: new File(['p2'], '02.png', { type: 'image/png' }), previewUrl: '', pageNumber: 2, status: 'pending', progress: 0 },
      ];
      const snapshot = structuredClone(items.map(({ file: _f, ...rest }) => rest));
      const settled: PageUploadItem[] = [];
      const batch$ = firstValueFrom(service.uploadPagesBatch(items, 'scans/c1', 2, (_c, _t, item) => settled.push(item)));

      const reqs = http.match((r) => r.url.includes('/storage/upload'));
      reqs[0].flush({ success: true, data: { storageKey: 'k1', cdnUrl: 'https://cdn/k1' }, error: null });
      reqs[1].flush({ success: false, data: null, error: 'File too large' }, { status: 413, statusText: 'Payload Too Large' });

      const results = await batch$;
      expect(results.map((r) => r.status)).toEqual(['done', 'error']);
      expect(results[1].error).toBe('File too large');
      expect(settled.length).toBe(2);
      // Inputs are untouched: results are new objects.
      expect(items.map(({ file: _f, ...rest }) => rest)).toEqual(snapshot);
      expect(results[0]).not.toBe(items[0]);
    });

    it('uploadPagesBatch skips pages that are already uploaded (retry)', async () => {
      const items: PageUploadItem[] = [
        { id: '1', file: new File(['p1'], '01.png'), previewUrl: '', pageNumber: 1, status: 'done', progress: 100, storageKey: 'k1', cdnUrl: 'https://cdn/k1' },
        { id: '2', file: new File(['p2'], '02.png'), previewUrl: '', pageNumber: 2, status: 'error', progress: 0, error: 'boom' },
      ];
      const batch$ = firstValueFrom(service.uploadPagesBatch(items, 'scans/c1'));

      http.expectOne((r) => r.url.includes('/storage/upload')).flush({ success: true, data: { storageKey: 'k2', cdnUrl: 'https://cdn/k2' }, error: null });

      const results = await batch$;
      expect(results.map((r) => [r.status, r.storageKey, r.error])).toEqual([
        ['done', 'k1', undefined],
        ['done', 'k2', undefined],
      ]);
    });

    it('createWork delegates to CatalogApi', async () => {
      const workPromise = firstValueFrom(
        service.createWork({
          title: 'Naruto',
          synopsis: 'Ninja story',
          type: 'MANGA',
          status: 'ONGOING',
          genres: ['Action'],
        })
      );

      const req = http.expectOne(`${API}/works`);
      expect(req.request.method).toBe('POST');
      req.flush({
        success: true,
        data: {
          id: 'w-1',
          title: 'Naruto',
          synopsis: 'Ninja story',
          type: 'MANGA',
          status: 'ONGOING',
          coverImageUrl: '',
          genres: ['Action'],
        },
        error: null,
      });

      const work = await workPromise;
      expect(work.id).toBe('w-1');
      expect(work.title).toBe('Naruto');
    });
  });
});
