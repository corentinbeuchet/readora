import { Component, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PageReportsApi } from '@app/core/api/page-reports-api';
import { PAGE_REPORT_REASON_LABELS, PageReport } from '@app/core/models/page-reports';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';

/** Pages readers reported as broken on this project's chapters (US-06), with "Mark fixed". */
@Component({
  selector: 'app-page-reports-panel',
  imports: [LoadError, RouterLink, DatePipe],
  templateUrl: './page-reports-panel.html',
  styleUrl: './page-reports-panel.scss'
})
export class PageReportsPanel {
  private readonly api = inject(PageReportsApi);

  readonly projectId = input<string | undefined>(undefined);

  protected readonly reports = this.api.openResource(this.projectId);
  protected readonly labels = PAGE_REPORT_REASON_LABELS;
  /** "Mark fixed": `busyKey` is the report being resolved. */
  protected readonly action = asyncAction($localize`:@@scanlation.reports.markFixedError:Could not mark the report as fixed.`);

  protected async markFixed(report: PageReport): Promise<void> {
    await this.action.run(
      async () => {
        await firstValueFrom(this.api.resolve(report.id));
        this.reports.reload();
      },
      { key: report.id }
    );
  }
}
