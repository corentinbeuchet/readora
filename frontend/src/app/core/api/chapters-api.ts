import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, Chapter } from '../models/readora.models';
import { ApiClient } from './api-client';

export type ViewMode = 'VERTICAL' | 'PAGED';

/** `/api/v1/chapters` (public). */
@Injectable({ providedIn: 'root' })
export class ChaptersApi {
  private readonly api = inject(ApiClient);

  getChapter(chapterId: string, viewMode: ViewMode = 'VERTICAL'): Observable<Chapter> {
    return this.api.get<Chapter>(`/chapters/${chapterId}`, { params: { viewMode } });
  }

  /** Reactive chapter loader: re-fetches whenever `chapterId()` changes; idle while it is empty. */
  chapterResource(chapterId: Signal<string | null | undefined>, viewMode: Signal<ViewMode>): HttpResourceRef<Chapter | undefined> {
    return httpResource<Chapter | undefined>(
      () => {
        const id = chapterId();
        return id ? { url: this.api.url(`/chapters/${id}`), params: { viewMode: viewMode() } } : undefined;
      },
      { parse: (raw) => (raw as ApiResponse<Chapter>).data ?? undefined }
    );
  }
}
