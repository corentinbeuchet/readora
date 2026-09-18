import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChapterComment, CommentUpvote, CreateCommentRequest } from '../models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

/** `/api/v1/comments` — reads are public, writes need `COMMENT_WRITE` / `COMMENT_UPVOTE`. */
@Injectable({ providedIn: 'root' })
export class CommentsApi {
  private readonly api = inject(ApiClient);

  forChapter(chapterId: string): Observable<ChapterComment[]> {
    return this.api.get<ChapterComment[]>(`/comments/chapter/${chapterId}`);
  }

  post(chapterId: string, request: CreateCommentRequest): Observable<ChapterComment> {
    return this.api.post<ChapterComment>(`/comments/chapter/${chapterId}`, request);
  }

  upvote(commentId: string): Observable<CommentUpvote> {
    return this.api.post<CommentUpvote>(`/comments/${commentId}/upvote`);
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
