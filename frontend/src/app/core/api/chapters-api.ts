import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Chapter } from '../models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

/** `/api/v1/chapters` (public). */
@Service()
export class ChaptersApi {
  private readonly api = inject(ApiClient);

  /**
   * Reactive chapter loader: re-fetches whenever `chapterId()` changes; idle while it is empty.
   * Deliberately not keyed on the reader's view mode: the payload is the same for both modes, and
   * switching mode must not re-fetch the chapter or reset the reading position.
   */
  chapterResource(chapterId: Signal<string | null | undefined>): HttpResourceRef<Chapter | undefined> {
    return httpResource<Chapter | undefined>(
      () => {
        const id = chapterId();
        return id ? this.api.url(`/chapters/${id}`) : undefined;
      },
      { parse: (raw) => parseEnvelope<Chapter>(raw) }
    );
  }
}
