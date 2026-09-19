import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageReportsPanel],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PageReportsPanel);
    fixture.componentRef.setInput('projectId', 'proj-1');
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('lists open reports with a link to the page and marks one fixed', async () => {
    http.expectOne(LIST_URL).flush(ok([REPORT]));
    await settle(fixture);

    const item: HTMLElement = fixture.nativeElement.querySelector('.report-item');
    expect(item.textContent).toContain('Chapter 1 · page 7');
    expect(item.textContent).toContain('Image corrupted or not loading');
    expect(item.querySelector('a')!.getAttribute('href')).toBe('/read/c-1?page=7');

    item.querySelector<HTMLButtonElement>('button')!.click();
    const resolve = http.expectOne(`${API}/page-reports/r-1/resolve`);
    expect(resolve.request.method).toBe('POST');
    resolve.flush(ok({ ...REPORT, status: 'RESOLVED' }));
    await settle(fixture);
    http.expectOne(LIST_URL).flush(ok([]));
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('No broken pages reported.');
  });

  it('explains a failed "Mark fixed" and keeps the report', async () => {
    http.expectOne(LIST_URL).flush(ok([REPORT]));
    await settle(fixture);

    fixture.nativeElement.querySelector('.report-item button').click();
    http.expectOne(`${API}/page-reports/r-1/resolve`).flush(fail('Only the chapter\'s team can mark this report as fixed'), { status: 403, statusText: 'Forbidden' });
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain("Only the chapter's team");
    expect(fixture.nativeElement.querySelectorAll('.report-item')).toHaveLength(1);
  });
});
