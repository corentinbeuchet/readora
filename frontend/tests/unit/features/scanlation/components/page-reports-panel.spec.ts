import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PageReportsPanel } from '@app/features/scanlation/components/page-reports-panel';
import { PageReport } from '@app/core/models/readora.models';
import { API, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

const LIST_URL = `${API}/scanlation/projects/proj-1/page-reports`;
const REPORT: PageReport = {
  id: 'r-1',
  chapterId: 'c-1',
  workId: 'w-1',
  chapterNumber: '1',
  pageNumber: 7,
  reason: 'IMAGE_CORRUPTED',
  status: 'OPEN',
  createdAt: '2026-09-10T10:00:00Z'
};

describe('PageReportsPanel (US-06 team side)', () => {
  let fixture: ComponentFixture<PageReportsPanel>;
  let http: HttpTestingController;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageReportsPanel],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists open reports with a link to the page and marks one fixed', async () => {
    await givenTheProjectHasOpenReports([REPORT]);

    thenReportShows(1, 'Chapter 1 · page 7');
    thenReportShows(1, 'Image corrupted or not loading');
    thenReportLinksTo(1, '/read/c-1?page=7');

    await whenIMarkReportFixed(1, { remaining: [] });

    thenTheRequestWas('POST', `${API}/page-reports/r-1/resolve`);
    thenICanSee('No broken pages reported.');
  });

  it('explains a failed "Mark fixed" and keeps the report', async () => {
    await givenTheProjectHasOpenReports([REPORT]);

    await whenIMarkReportFixedButItIsRefused(1, "Only the chapter's team can mark this report as fixed");

    thenISeeTheError("Only the chapter's team");
    thenISeeReports(1);
  });

  async function givenTheProjectHasOpenReports(reports: PageReport[]): Promise<void> {
    fixture = TestBed.createComponent(PageReportsPanel);
    fixture.componentRef.setInput('projectId', 'proj-1');
    await settle(fixture);
    http.expectOne(LIST_URL).flush(ok(reports));
    await settle(fixture);
  }

  async function whenIMarkReportFixed(position: number, answer: { remaining: PageReport[] }): Promise<void> {
    markFixedButton(position).click();
    lastRequest = http.expectOne(`${API}/page-reports/${REPORT.id}/resolve`);
    lastRequest.flush(ok({ ...REPORT, status: 'RESOLVED' }));
    await settle(fixture);
    http.expectOne(LIST_URL).flush(ok(answer.remaining));
    await settle(fixture);
  }

  async function whenIMarkReportFixedButItIsRefused(position: number, error: string): Promise<void> {
    markFixedButton(position).click();
    http.expectOne(`${API}/page-reports/${REPORT.id}/resolve`).flush(fail(error), { status: 403, statusText: 'Forbidden' });
    await settle(fixture);
  }

  function thenReportShows(position: number, text: string): void {
    expect(reportItem(position).textContent).toContain(text);
  }

  function thenReportLinksTo(position: number, href: string): void {
    expect(reportItem(position).querySelector('a')!.getAttribute('href')).toBe(href);
  }

  function thenTheRequestWas(method: string, url: string): void {
    expect(lastRequest.request.method).toBe(method);
    expect(lastRequest.request.url).toBe(url);
  }

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function thenISeeTheError(text: string): void {
    expect(page().querySelector('[role="alert"]')!.textContent).toContain(text);
  }

  function thenISeeReports(count: number): void {
    expect(page().querySelectorAll('.report-item')).toHaveLength(count);
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function reportItem(position: number): HTMLElement {
    return page().querySelectorAll<HTMLElement>('.report-item')[position - 1];
  }

  function markFixedButton(position: number): HTMLButtonElement {
    return reportItem(position).querySelector<HTMLButtonElement>('button')!;
  }
});
