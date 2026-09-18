import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Bookmark, UpdateProgressRequest } from '../models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

/** `/api/v1/bookmarks` (requires `BOOKMARK_READ` / `BOOKMARK_WRITE`). */
@Service()
export class BookmarksApi {
  private readonly api = inject(ApiClient);

  list(): Observable<Bookmark[]> {
    return this.api.get<Bookmark[]>('/bookmarks');
  }

  forWork(workId: string): Observable<Bookmark> {
    return this.api.get<Bookmark>(`/bookmarks/${workId}`);
  }

  updateProgress(workId: string, request: UpdateProgressRequest): Observable<Bookmark> {
    return this.api.put<Bookmark>(`/bookmarks/${workId}/progress`, request);
  }

  /** Reactive list of bookmarks; pass a signal that is `false` to skip loading (e.g. no permission). */
  listResource(enabled: Signal<boolean>): HttpResourceRef<Bookmark[]> {
    return httpResource<Bookmark[]>(() => (enabled() ? this.api.url('/bookmarks') : undefined), {
      parse: (raw) => parseEnvelope<Bookmark[]>(raw) ?? [],
      defaultValue: []
    });
  }
}
