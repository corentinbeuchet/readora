import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ReadingList, ReadingListPayload } from '@app/core/models/reading-lists';
import { ApiClient, parseEnvelope } from './api-client';

/** Readers' lists of series (US-05). Published lists are public; writes need `LIBRARY_USE`. */
@Service()
export class ListsApi {
  private readonly api = inject(ApiClient);

  create(payload: ReadingListPayload): Observable<ReadingList> {
    return this.api.post<ReadingList>('/lists', payload);
  }

  update(listId: string, payload: ReadingListPayload): Observable<ReadingList> {
    return this.api.put<ReadingList>(`/lists/${listId}`, payload);
  }

  addItem(listId: string, workId: string, note?: string): Observable<ReadingList> {
    return this.api.post<ReadingList>(`/lists/${listId}/items`, { workId, note: note || null });
  }

  upvote(listId: string): Observable<number> {
    return this.api.post<{ upvotes: number }>(`/lists/${listId}/upvote`).pipe(map((r) => r.upvotes));
  }

  topResource(): HttpResourceRef<ReadingList[]> {
    return httpResource<ReadingList[]>(() => this.api.url('/lists'), { parse: (raw) => parseEnvelope<ReadingList[]>(raw) ?? [], defaultValue: [] });
  }

  mineResource(enabled: Signal<boolean>): HttpResourceRef<ReadingList[]> {
    return httpResource<ReadingList[]>(() => (enabled() ? this.api.url('/lists/mine') : undefined), {
      parse: (raw) => parseEnvelope<ReadingList[]>(raw) ?? [],
      defaultValue: []
    });
  }

  listResource(listId: Signal<string | undefined>): HttpResourceRef<ReadingList | undefined> {
    return httpResource<ReadingList | undefined>(
      () => {
        const id = listId();
        return id ? this.api.url(`/lists/${id}`) : undefined;
      },
      { parse: (raw) => parseEnvelope<ReadingList>(raw) }
    );
  }
}
