import { Service, inject } from '@angular/core';
import { Observable, catchError, from, map, mergeMap, of, toArray } from 'rxjs';
import { ApiClient, apiErrorMessage } from '@app/core/api/api-client';
import { StorageUploadResult } from '@app/core/models/readora.models';
import { PageUploadItem } from './file-utils';

@Service()
export class UploadService {
  private readonly api = inject(ApiClient);

  /**
   * Upload a single multipart file to storage.
   */
  uploadFile(file: File, folder = 'uploads'): Observable<StorageUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<StorageUploadResult>(`/storage/upload?folder=${encodeURIComponent(folder)}`, formData);
  }

  /**
   * Upload cover image file to storage.
   */
  uploadCover(file: File): Observable<StorageUploadResult> {
    return this.uploadFile(file, 'covers');
  }

  /**
   * Uploads a batch of chapter pages with bounded concurrency.
   *
   * Never errors and never mutates its input: every item is settled into a **new** object, either
   * `done` (with `storageKey`/`cdnUrl`) or `error` (with a message), so callers can store results in
   * signals and retry only the failed ones. Items already `done` are not re-uploaded.
   * `onSettled` fires once per item with the running count and the settled item.
   */
  uploadPagesBatch(
    items: readonly PageUploadItem[],
    folder = 'scans',
    concurrency = 3,
    onSettled?: (completed: number, total: number, item: PageUploadItem) => void
  ): Observable<PageUploadItem[]> {
    if (items.length === 0) {
      return of([]);
    }

    let completedCount = 0;
    const totalCount = items.length;
    const settle = (item: PageUploadItem): PageUploadItem => {
      completedCount++;
      onSettled?.(completedCount, totalCount, item);
      return item;
    };

    return from(items).pipe(
      mergeMap((item) => {
        if (item.status === 'done' && item.storageKey && item.cdnUrl) {
          return of(settle(item));
        }
        return this.uploadFile(item.file, folder).pipe(
          map((res): PageUploadItem => ({
            ...item,
            status: 'done',
            progress: 100,
            storageKey: res.storageKey,
            cdnUrl: res.cdnUrl,
            liteCdnUrl: res.liteCdnUrl ?? undefined,
            error: undefined,
          })),
          catchError((err: unknown) =>
            of<PageUploadItem>({ ...item, status: 'error', progress: 0, error: apiErrorMessage(err, 'Upload failed') })
          ),
          map(settle)
        );
      }, concurrency),
      toArray(),
      map((results) => [...results].sort((a, b) => a.pageNumber - b.pageNumber))
    );
  }
}
