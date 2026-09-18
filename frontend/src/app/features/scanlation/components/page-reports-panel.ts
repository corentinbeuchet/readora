import { Component, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { PageReportsApi } from '@app/core/api/page-reports-api';
import { PAGE_REPORT_REASON_LABELS, PageReport } from '@app/core/models/readora.models';

/** Pages readers reported as broken on this project's chapters (US-06), with "Mark fixed". */
@Component({
  selector: 'app-page-reports-panel',
  imports: [RouterLink, DatePipe],
  templateUrl: './page-reports-panel.html',
  styleUrl: './page-reports-panel.scss'
})
export class PageReportsPanel {
  private readonly api = inject(PageReportsApi);

  readonly projectId = input<string | undefined>(undefined);

  protected readonly reports = this.api.openResource(this.projectId);
  protected readonly labels = PAGE_REPORT_REASON_LABELS;
  protected readonly busyId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected async markFixed(report: PageReport): Promise<void> {
    this.busyId.set(report.id);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.api.resolve(report.id));
      this.reports.reload();
    } catch (error) {
      this.actionError.set(apiErrorMessage(error, 'Could not mark the report as fixed.'));
    } finally {
      this.busyId.set(null);
    }
  }
}
