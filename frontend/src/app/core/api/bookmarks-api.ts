import { httpResource, HttpResourceRef } from '@angular/common/http';
import { ResourceRef, Service, Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { Bookmark, UpdateProgressRequest } from '@app/core/models/library';
import { ApiClient, nullIfNotFound, parseEnvelope } from './api-client';

/** `/api/v1/bookmarks` (requires `BOOKMARK_READ` / `BOOKMARK_WRITE`). */
@Service()
export class BookmarksApi {
  private readonly api = inject(ApiClient);

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

  /** My bookmark of one series (`null` when I have none); idle while `enabled` is false. */
  forWorkResource(workId: Signal<string>, enabled: Signal<boolean>): ResourceRef<Bookmark | null | undefined> {
    return rxResource({
      params: () => (enabled() ? workId() : undefined),
      stream: ({ params }) => this.api.get<Bookmark>(`/bookmarks/${params}`).pipe(nullIfNotFound())
    });
  }
}
