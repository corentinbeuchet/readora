import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, ChapterSummary, PagedResponse, Work, WorkSummary } from '../models/readora.models';
import { ApiClient } from './api-client';

const EMPTY_PAGE: PagedResponse<WorkSummary> = { items: [], page: 0, size: 0, totalElements: 0, totalPages: 0 };

/** `/api/v1/works` (public catalog). */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly api = inject(ApiClient);

  listWorks(page = 0, size = 20): Observable<PagedResponse<WorkSummary>> {
    return this.api.get<PagedResponse<WorkSummary>>('/works', { params: { page, size } });
  }

  getWork(workId: string): Observable<Work> {
    return this.api.get<Work>(`/works/${workId}`);
  }

  listChapters(workId: string): Observable<ChapterSummary[]> {
    return this.api.get<ChapterSummary[]>(`/works/${workId}/chapters`);
  }

  worksResource(page: Signal<number>, size: Signal<number>): HttpResourceRef<PagedResponse<WorkSummary>> {
    return httpResource<PagedResponse<WorkSummary>>(
      () => ({ url: this.api.url('/works'), params: { page: page(), size: size() } }),
      { parse: (raw) => (raw as ApiResponse<PagedResponse<WorkSummary>>).data ?? EMPTY_PAGE, defaultValue: EMPTY_PAGE }
    );
  }

  workResource(workId: Signal<string | null | undefined>): HttpResourceRef<Work | undefined> {
    return httpResource<Work | undefined>(
      () => {
        const id = workId();
        return id ? this.api.url(`/works/${id}`) : undefined;
      },
      { parse: (raw) => (raw as ApiResponse<Work>).data ?? undefined }
    );
  }

  chaptersResource(workId: Signal<string | null | undefined>): HttpResourceRef<ChapterSummary[]> {
    return httpResource<ChapterSummary[]>(
      () => {
        const id = workId();
        return id ? this.api.url(`/works/${id}/chapters`) : undefined;
      },
      { parse: (raw) => (raw as ApiResponse<ChapterSummary[]>).data ?? [], defaultValue: [] }
    );
  }
}
