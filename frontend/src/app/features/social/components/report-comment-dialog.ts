import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FocusTrapDirective } from '@app/core/a11y/focus-trap.directive';
import { apiErrorMessage } from '@app/core/api/api-client';
import { ModerationApi } from '@app/core/api/moderation-api';
import { COMMENT_REPORT_REASON_LABELS, ChapterComment, CommentReportReason } from '@app/core/models/readora.models';

/** "Report this comment" (US-11): why, then the moderators get it. */
@Component({
  selector: 'app-report-comment-dialog',
  imports: [FocusTrapDirective],
  templateUrl: './report-comment-dialog.html',
  styleUrl: './report-comment-dialog.scss'
})
export class ReportCommentDialog {
  private readonly api = inject(ModerationApi);

  readonly comment = input.required<ChapterComment>();
  readonly closed = output<void>();
  readonly reported = output<void>();

  protected readonly reasons = Object.keys(COMMENT_REPORT_REASON_LABELS) as CommentReportReason[];
  protected readonly labels = COMMENT_REPORT_REASON_LABELS;
  protected readonly reason = signal<CommentReportReason>('UNMARKED_SPOILER');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.reportComment(this.comment().id, this.reason()));
      this.reported.emit();
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Could not send the report. Please try again.'));
    } finally {
      this.sending.set(false);
    }
  }
}
