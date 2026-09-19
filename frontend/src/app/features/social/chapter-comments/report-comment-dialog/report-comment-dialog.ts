import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Dialog } from '@app/shared/ui/dialog/dialog';
import { ModerationApi } from '@app/core/api/moderation-api';
import { COMMENT_REPORT_REASON_LABELS, ChapterComment, CommentReportReason } from '@app/core/models/comments';
import { asyncAction } from '@app/core/utils/async-action';

/** "Report this comment" (US-11): why, then the moderators get it. */
@Component({
  selector: 'app-report-comment-dialog',
  imports: [Dialog],
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
  protected readonly sending = asyncAction('Could not send the report. Please try again.');

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.sending.busy()) return;
    await this.sending.run(async () => {
      await firstValueFrom(this.api.reportComment(this.comment().id, this.reason()));
      this.reported.emit();
    });
  }
}
