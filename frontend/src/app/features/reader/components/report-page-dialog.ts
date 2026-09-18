import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FocusTrapDirective } from '@app/core/a11y/focus-trap.directive';
import { apiErrorMessage } from '@app/core/api/api-client';
import { PageReportsApi } from '@app/core/api/page-reports-api';
import { PAGE_REPORT_REASON_LABELS, PageReportReason } from '@app/core/models/readora.models';

/** "Report this page" (US-06): why the page doesn't display; the scanlation team gets the report. */
@Component({
  selector: 'app-report-page-dialog',
  imports: [FocusTrapDirective],
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
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected choose(reason: PageReportReason): void {
    this.reason.set(reason);
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.sending()) {
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.report(this.chapterId(), this.pageNumber(), this.reason()));
      this.reported.emit(this.pageNumber());
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Could not send the report. Please try again.'));
    } finally {
      this.sending.set(false);
    }
  }
}
