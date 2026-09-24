import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CommentReportReason, ModerationItem } from '@app/core/models/comments';
import { WaitingChapter } from '@app/core/models/chapter';
import { ApiClient, parseEnvelope } from './api-client';

/** Comment reports (`COMMENT_REPORT`), the moderation queue and first-chapter review (`COMMENT_MODERATE`), US-11. */
@Service()
export class ModerationApi {
  private readonly api = inject(ApiClient);

  reportComment(commentId: string, reason: CommentReportReason): Observable<{ reportId: string }> {
    return this.api.post<{ reportId: string }>(`/comments/${commentId}/reports`, { reason });
  }

  hide(reportId: string): Observable<unknown> {
    return this.api.post(`/moderation/reports/${reportId}/hide`);
  }

  dismiss(reportId: string): Observable<unknown> {
    return this.api.post(`/moderation/reports/${reportId}/dismiss`);
  }

  queueResource(): HttpResourceRef<ModerationItem[]> {
    return httpResource<ModerationItem[]>(() => this.api.url('/moderation/reports'), {
      parse: (raw) => parseEnvelope<ModerationItem[]>(raw) ?? [],
      defaultValue: []
    });
  }

  /** A team's first chapters waiting for review, the longest-waiting first. */
  waitingChaptersResource(): HttpResourceRef<WaitingChapter[]> {
    return httpResource<WaitingChapter[]>(() => this.api.url('/moderation/chapters'), {
      parse: (raw) => parseEnvelope<WaitingChapter[]>(raw) ?? [],
      defaultValue: []
    });
  }

  /** Readers see the chapter, and its series' readers are told. */
  approveChapter(chapterId: string): Observable<unknown> {
    return this.api.post(`/moderation/chapters/${chapterId}/approve`);
  }

  /** The chapter goes back to its team as a draft; its leaders are told. */
  sendBackChapter(chapterId: string): Observable<unknown> {
    return this.api.post(`/moderation/chapters/${chapterId}/send-back`);
  }
}
