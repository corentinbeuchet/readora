import { Injectable, inject } from '@angular/core';
import { Observable, from, map, mergeMap, of, toArray } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { CatalogApi } from '../api/catalog-api';
import { ScanlationApi } from '../api/scanlation-api';
import {
  Chapter,
  CreateTaskRequest,
  CreateWorkPayload,
  DirectPublishChapterPayload,
  ScanlationProject,
  StorageUploadResult,
  Work,
  WorkflowTask,
} from '../models/readora.models';
import { PageUploadItem } from './file-utils';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly api = inject(ApiClient);
  private readonly catalogApi = inject(CatalogApi);
  private readonly scanlationApi = inject(ScanlationApi);

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
   * Upload a batch of chapter pages concurrently with progress reporting.
   */
  uploadPagesBatch(
    items: PageUploadItem[],
    folder = 'scans',
    concurrency = 3,
    onProgress?: (completed: number, total: number) => void
  ): Observable<PageUploadItem[]> {
    if (items.length === 0) {
      return of([]);
    }

    let completedCount = 0;
    const totalCount = items.length;

    return from(items).pipe(
      mergeMap((item) => {
        if (item.status === 'done' && item.storageKey && item.cdnUrl) {
          completedCount++;
          onProgress?.(completedCount, totalCount);
          return of(item);
        }

        item.status = 'uploading';
        item.progress = 10;

        return this.uploadFile(item.file, folder).pipe(
          map((res) => {
            item.status = 'done';
            item.progress = 100;
            item.storageKey = res.storageKey;
            item.cdnUrl = res.cdnUrl;
            completedCount++;
            onProgress?.(completedCount, totalCount);
            return item;
          })
        );
      }, concurrency),
      toArray(),
      map((results) => [...results].sort((a, b) => a.pageNumber - b.pageNumber))
    );
  }

  /**
   * Create a new work.
   */
  createWork(payload: CreateWorkPayload): Observable<Work> {
    return this.catalogApi.createWork(payload);
  }

  /**
   * Directly publish a chapter with pages.
   */
  directPublishChapter(workId: string, payload: DirectPublishChapterPayload): Observable<Chapter> {
    return this.catalogApi.directPublishChapter(workId, payload);
  }

  /**
   * Create a scanlation workflow task attached to a project.
   */
  createScanlationTask(projectId: string, req: CreateTaskRequest): Observable<WorkflowTask> {
    return this.scanlationApi.createTask(projectId, req);
  }

  /**
   * List projects associated with a work.
   */
  getProjectsForWork(workId: string): Observable<ScanlationProject[]> {
    return this.catalogApi.listProjects(workId);
  }
}
