import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Dialog } from '@app/shared/ui/dialog/dialog';
import { PageReportsApi } from '@app/core/api/page-reports-api';
import { PAGE_REPORT_REASON_LABELS, PageReportReason } from '@app/core/models/readora.models';
import { asyncAction } from '@app/core/utils/async-action';

/** "Report this page" (US-06): why the page doesn't display; the scanlation team gets the report. */
@Component({
  selector: 'app-report-page-dialog',
  imports: [Dialog],
  templateUrl: './report-page-dialog.html',
  styleUrl: './report-page-dialog.scss'
})
export class ReportPageDialog {
  private readonly api = inject(PageReportsApi);

  readonly chapterId = input.required<string>();
  readonly pageNumber = input.required<number>();
  readonly closed = output<void>();
  readonly reported = output<number>();

  protected readonly reasons = Object.keys(PAGE_REPORT_REASON_LABELS) as PageReportReason[];
  protected readonly labels = PAGE_REPORT_REASON_LABELS;
  protected readonly reason = signal<PageReportReason>('IMAGE_CORRUPTED');
  protected readonly sending = asyncAction('Could not send the report. Please try again.');

  protected choose(reason: PageReportReason): void {
    this.reason.set(reason);
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.sending.busy()) return;
    await this.sending.run(async () => {
      await firstValueFrom(this.api.report(this.chapterId(), this.pageNumber(), this.reason()));
      this.reported.emit(this.pageNumber());
    });
  }
}
