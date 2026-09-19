import { httpResource, HttpResourceRef } from '@angular/common/http';
import { ResourceRef, Service, Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { LibraryEntry, LibraryItem, ReadingStatus } from '@app/core/models/library';
import { ApiClient, nullIfNotFound, parseEnvelope } from './api-client';

/** `/api/v1/library`: the reader's own library (requires `LIBRARY_USE`). */
@Service()
export class LibraryApi {
  private readonly api = inject(ApiClient);

  /** Adds the series, or changes its status. Without a status a new entry is `READING`. */
  save(workId: string, status?: ReadingStatus): Observable<LibraryEntry> {
    return this.api.put<LibraryEntry>(`/library/${workId}`, status ? { status } : {});
  }

  /** Turns new-chapter notifications for a series in my library on or off (US-10). */
  setNotifications(workId: string, enabled: boolean): Observable<unknown> {
    return this.api.put(`/library/${workId}/notifications`, { enabled });
  }

  remove(workId: string): Observable<void> {
    return this.api.delete(`/library/${workId}`);
  }

  /** My library entry for one series (`null` when it is not in my library); idle while `enabled` is false. */
  entryResource(workId: Signal<string>, enabled: Signal<boolean>): ResourceRef<LibraryEntry | null | undefined> {
    return rxResource({
      params: () => (enabled() ? workId() : undefined),
      stream: ({ params }) => this.api.get<LibraryEntry>(`/library/${params}`).pipe(nullIfNotFound())
    });
  }

  /** The library, optionally one status only; idle while `enabled` is false. */
  listResource(status: Signal<ReadingStatus | undefined>, enabled: Signal<boolean>): HttpResourceRef<LibraryItem[]> {
    return httpResource<LibraryItem[]>(
      () => {
        if (!enabled()) return undefined;
        const only = status();
        const params: Record<string, string> = only ? { status: only } : {};
        return { url: this.api.url('/library'), params };
      },
      { parse: (raw) => parseEnvelope<LibraryItem[]>(raw) ?? [], defaultValue: [] }
    );
  }
}
