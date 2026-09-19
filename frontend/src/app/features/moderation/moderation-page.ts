import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { ModerationApi } from '@app/core/api/moderation-api';
import { COMMENT_REPORT_REASON_LABELS, ModerationItem } from '@app/core/models/readora.models';
import { SeoService } from '@app/core/seo/seo.service';

/** Moderation queue (US-11): reported comments, oldest first; hide the comment or dismiss the report. */
@Component({
  selector: 'app-moderation-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './moderation-page.html',
  styleUrl: './moderation-page.scss'
})
export class ModerationPage {
  private readonly api = inject(ModerationApi);
  protected readonly queue = this.api.queueResource();
  protected readonly labels = COMMENT_REPORT_REASON_LABELS;
  protected readonly busyId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  constructor() {
    inject(SeoService).private_('Moderation');
  }

  protected hide(item: ModerationItem): Promise<void> {
    return this.act(item, () => firstValueFrom(this.api.hide(item.reportId)));
  }

  protected dismiss(item: ModerationItem): Promise<void> {
    return this.act(item, () => firstValueFrom(this.api.dismiss(item.reportId)));
  }

  private async act(item: ModerationItem, action: () => Promise<unknown>): Promise<void> {
    this.busyId.set(item.reportId);
    this.actionError.set(null);
    try {
      await action();
      this.queue.reload();
    } catch (error) {
      this.actionError.set(apiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }
}
