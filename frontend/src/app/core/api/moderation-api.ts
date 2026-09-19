import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CommentReportReason, ModerationItem } from '@app/core/models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

/** Comment reports (`COMMENT_REPORT`) and the moderation queue (`COMMENT_MODERATE`), US-11. */
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
}
