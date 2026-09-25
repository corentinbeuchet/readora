import { TimeAgoPipe } from '@app/shared/ui/time-ago.pipe';
import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ModerationApi } from '@app/core/api/moderation-api';
import { COMMENT_REPORT_REASON_LABELS, ModerationItem } from '@app/core/models/comments';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';
import { ChapterReview } from './chapter-review/chapter-review';

/** Moderation (US-11): a team's first chapters waiting for review, then reported comments (hide the comment or dismiss the report). */
@Component({
  selector: 'app-moderation-page',
  imports: [TimeAgoPipe, LoadError, RouterLink, DatePipe, ChapterReview],
  templateUrl: './moderation-page.html',
  styleUrl: './moderation-page.scss'
})
export class ModerationPage {
  private readonly api = inject(ModerationApi);
  protected readonly queue = this.api.queueResource();
  protected readonly labels = COMMENT_REPORT_REASON_LABELS;
  /** Hide / dismiss: `busyKey` is the report being handled. */
  protected readonly action = asyncAction();

  constructor() {
    inject(SeoService).private_($localize`:@@moderation.page.seoTitle:Moderation`);
  }

  protected hide(item: ModerationItem): Promise<void> {
    return this.act(item, () => firstValueFrom(this.api.hide(item.reportId)));
  }

  protected dismiss(item: ModerationItem): Promise<void> {
    return this.act(item, () => firstValueFrom(this.api.dismiss(item.reportId)));
  }

  private async act(item: ModerationItem, action: () => Promise<unknown>): Promise<void> {
    await this.action.run(
      async () => {
        await action();
        this.queue.reload();
      },
      { key: item.reportId }
    );
  }
}
