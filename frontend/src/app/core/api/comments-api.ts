import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChapterComment, CommentUpvote, CreateCommentRequest } from '../models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

/** `/api/v1/comments` — reads are public, writes need `COMMENT_WRITE` / `COMMENT_UPVOTE`. */
@Service()
export class CommentsApi {
  private readonly api = inject(ApiClient);

  post(chapterId: string, request: CreateCommentRequest): Observable<ChapterComment> {
    return this.api.post<ChapterComment>(`/comments/chapter/${chapterId}`, request);
  }

  upvote(commentId: string): Observable<CommentUpvote> {
    return this.api.post<CommentUpvote>(`/comments/${commentId}/upvote`);
  }

  /** The best comments shown at the end of a chapter: top-level, no spoilers, most upvoted first (US-07). */
  topResource(chapterId: Signal<string | null | undefined>, limit = 3): HttpResourceRef<ChapterComment[]> {
    return httpResource<ChapterComment[]>(
      () => {
        const id = chapterId();
        return id ? { url: this.api.url(`/comments/chapter/${id}/top`), params: { limit } } : undefined;
      },
      { parse: (raw) => parseEnvelope<ChapterComment[]>(raw) ?? [], defaultValue: [] }
    );
  }

  forChapterResource(chapterId: Signal<string | null | undefined>): HttpResourceRef<ChapterComment[]> {
    return httpResource<ChapterComment[]>(
      () => {
        const id = chapterId();
        return id ? this.api.url(`/comments/chapter/${id}`) : undefined;
      },
      { parse: (raw) => parseEnvelope<ChapterComment[]>(raw) ?? [], defaultValue: [] }
    );
  }
}
