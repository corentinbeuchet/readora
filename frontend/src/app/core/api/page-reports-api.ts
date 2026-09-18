import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageReport, PageReportReason } from '../models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

/** Broken-page reports: readers report (`PAGE_REPORT`), the chapter's team lists and fixes them. */
@Service()
export class PageReportsApi {
  private readonly api = inject(ApiClient);

  /** Reporting a page that the reader already reported returns the open report. */
  report(chapterId: string, pageNumber: number, reason: PageReportReason): Observable<PageReport> {
    return this.api.post<PageReport>(`/chapters/${chapterId}/pages/${pageNumber}/reports`, { reason });
  }

  resolve(reportId: string): Observable<PageReport> {
    return this.api.post<PageReport>(`/page-reports/${reportId}/resolve`);
  }

  openResource(projectId: Signal<string | undefined>): HttpResourceRef<PageReport[]> {
    return httpResource<PageReport[]>(
      () => {
        const id = projectId();
        return id ? this.api.url(`/scanlation/projects/${id}/page-reports`) : undefined;
      },
      { parse: (raw) => parseEnvelope<PageReport[]>(raw) ?? [], defaultValue: [] }
    );
  }
}
