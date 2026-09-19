import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChapterRead, HistoryItem, WorkProgress } from '@app/core/models/library';
import { ApiClient, parseEnvelope } from './api-client';

/** `/api/v1/reading`: reading history and read markers (requires `LIBRARY_USE`). */
@Service()
export class ReadingApi {
  private readonly api = inject(ApiClient);

  /** Records a visit of a chapter; `finished` (reached the last page) never goes back to false on the server. */
  recordRead(chapterId: string, finished: boolean): Observable<ChapterRead> {
    return this.api.put<ChapterRead>(`/reading/chapters/${chapterId}`, { finished });
  }

  /** "Mark all previous as read": every published chapter before this one becomes finished. */
  markReadUpTo(chapterId: string): Observable<WorkProgress> {
    return this.api.post<WorkProgress>(`/reading/chapters/${chapterId}/read-up-to`);
  }

  historyResource(enabled: Signal<boolean>): HttpResourceRef<HistoryItem[]> {
    return httpResource<HistoryItem[]>(() => (enabled() ? this.api.url('/reading/history') : undefined), {
      parse: (raw) => parseEnvelope<HistoryItem[]>(raw) ?? [],
      defaultValue: []
    });
  }

  progressResource(workId: Signal<string | undefined>, enabled: Signal<boolean>): HttpResourceRef<WorkProgress | undefined> {
    return httpResource<WorkProgress | undefined>(
      () => {
        const id = workId();
        return id && enabled() ? this.api.url(`/reading/works/${id}`) : undefined;
      },
      { parse: (raw) => parseEnvelope<WorkProgress>(raw) }
    );
  }
}
