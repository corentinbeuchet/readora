import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LibraryEntry, LibraryItem, ReadingStatus } from '../models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

/** `/api/v1/library`: the reader's own library (requires `LIBRARY_USE`). */
@Service()
export class LibraryApi {
  private readonly api = inject(ApiClient);

  /** Adds the series, or changes its status. Without a status a new entry is `READING`. */
  save(workId: string, status?: ReadingStatus): Observable<LibraryEntry> {
    return this.api.put<LibraryEntry>(`/library/${workId}`, status ? { status } : {});
  }

  remove(workId: string): Observable<void> {
    return this.api.delete(`/library/${workId}`);
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
