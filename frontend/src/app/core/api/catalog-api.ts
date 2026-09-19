import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CatalogQuery, Chapter, ChapterSummary, CreateWorkPayload, DirectPublishChapterPayload, PagedResponse, ScanlationProject, Work, WorkSummary } from '../models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

const EMPTY_PAGE: PagedResponse<WorkSummary> = { items: [], page: 0, size: 0, totalElements: 0, totalPages: 0 };

/** Maps catalog filters to the backend's query parameters (`q`, repeated `genre` / `excludeGenre`, …). */
export function catalogParams(query: CatalogQuery): Record<string, string | number | readonly string[]> {
  const params: Record<string, string | number | readonly string[]> = { page: query.page, size: query.size };
  const text = query.text?.trim();
  if (text) params['q'] = text;
  if (query.genres?.length) params['genre'] = query.genres;
  if (query.excludedGenres?.length) params['excludeGenre'] = query.excludedGenres;
  if (query.type) params['type'] = query.type;
  if (query.status) params['status'] = query.status;
  if (query.demographic) params['demographic'] = query.demographic;
  return params;
}

/** `/api/v1/works` (public catalog). */
@Service()
export class CatalogApi {
  private readonly api = inject(ApiClient);

  /** Quick title/author search for the header search box. */
  suggest(text: string, limit = 5): Observable<WorkSummary[]> {
    return this.api
      .get<PagedResponse<WorkSummary>>('/works', { params: catalogParams({ text, page: 0, size: limit }) })
      .pipe(map((page) => page.items));
  }

  createWork(payload: CreateWorkPayload): Observable<Work> {
    return this.api.post<Work>('/works', payload);
  }

  listProjects(workId: string): Observable<ScanlationProject[]> {
    return this.api.get<ScanlationProject[]>(`/works/${workId}/projects`);
  }

  directPublishChapter(workId: string, payload: DirectPublishChapterPayload): Observable<Chapter> {
    return this.api.post<Chapter>(`/works/${workId}/chapters/direct`, payload);
  }

  worksResource(query: Signal<CatalogQuery>): HttpResourceRef<PagedResponse<WorkSummary>> {
    return httpResource<PagedResponse<WorkSummary>>(
      () => ({ url: this.api.url('/works'), params: catalogParams(query()) }),
      { parse: (raw) => parseEnvelope<PagedResponse<WorkSummary>>(raw) ?? EMPTY_PAGE, defaultValue: EMPTY_PAGE }
    );
  }

  /** Every genre used in the catalog, sorted (for the genre filter). */
  genresResource(): HttpResourceRef<string[]> {
    return httpResource<string[]>(() => this.api.url('/works/genres'), {
      parse: (raw) => parseEnvelope<string[]>(raw) ?? [],
      defaultValue: []
    });
  }

  workResource(workId: Signal<string | null | undefined>): HttpResourceRef<Work | undefined> {
    return httpResource<Work | undefined>(
      () => {
        const id = workId();
        return id ? this.api.url(`/works/${id}`) : undefined;
      },
      { parse: (raw) => parseEnvelope<Work>(raw) }
    );
  }

  chaptersResource(workId: Signal<string | null | undefined>): HttpResourceRef<ChapterSummary[]> {
    return httpResource<ChapterSummary[]>(
      () => {
        const id = workId();
        return id ? this.api.url(`/works/${id}/chapters`) : undefined;
      },
      { parse: (raw) => parseEnvelope<ChapterSummary[]>(raw) ?? [], defaultValue: [] }
    );
  }
}
