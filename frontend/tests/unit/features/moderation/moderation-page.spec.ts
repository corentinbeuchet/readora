import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ModerationPage } from '@app/features/moderation/moderation-page';
import { ModerationItem } from '@app/core/models/readora.models';
import { API, fail, ok, provideHttpTesting, settle } from '../../test-utils';

const ITEM: ModerationItem = {
  reportId: 'r-1',
  reason: 'UNMARKED_SPOILER',
  reportedAt: '2026-09-10T10:00:00Z',
  commentId: 'c-1',
  chapterId: 'ch-5',
  authorUsername: 'aoi',
  content: 'He dies in the end',
  spoiler: false
};

describe('ModerationPage (US-11)', () => {
  let fixture: ComponentFixture<ModerationPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModerationPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows each reported comment with its reason and a link to it in context', async () => {
    await whenIOpenTheQueue([ITEM]);

    thenTheReportShows(1, 'Unmarked spoiler');
    thenTheReportShows(1, 'He dies in the end');
    thenTheReportLinksTo(1, '/read/ch-5?comment=c-1');
  });

  it('hides the comment, then reloads the queue', async () => {
    await givenTheQueueHolds([ITEM]);

    await whenIHideTheCommentOf(ITEM, { queueAfter: [] });

    thenICanSee('No open reports.');
  });

  it('dismisses a report and shows errors', async () => {
    await givenTheQueueHolds([ITEM]);

    await whenIDismissTheReportButItFails(ITEM, 'Open comment report not found');

    thenTheAlertSays('Open comment report not found');
  });

  async function givenTheQueueHolds(reports: ModerationItem[]): Promise<void> {
    await whenIOpenTheQueue(reports);
  }

  async function whenIOpenTheQueue(reports: ModerationItem[]): Promise<void> {
    fixture = TestBed.createComponent(ModerationPage);
    await settle(fixture);
    http.expectOne(`${API}/moderation/reports`).flush(ok(reports));
    await settle(fixture);
  }

  async function whenIHideTheCommentOf(report: ModerationItem, answer: { queueAfter: ModerationItem[] }): Promise<void> {
    actionButtons()[0].click();
    http.expectOne(`${API}/moderation/reports/${report.reportId}/hide`).flush(ok({ status: 'HIDDEN' }));
    await settle(fixture);
    http.expectOne(`${API}/moderation/reports`).flush(ok(answer.queueAfter));
    await settle(fixture);
  }

  async function whenIDismissTheReportButItFails(report: ModerationItem, error: string): Promise<void> {
    actionButtons()[1].click();
    http.expectOne(`${API}/moderation/reports/${report.reportId}/dismiss`).flush(fail(error), { status: 404, statusText: 'Not Found' });
    await settle(fixture);
  }

  function thenTheReportShows(position: number, text: string): void {
    expect(reportRow(position).textContent).toContain(text);
  }

  function thenTheReportLinksTo(position: number, href: string): void {
    expect(reportRow(position).querySelector('a')!.getAttribute('href')).toBe(href);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function thenTheAlertSays(message: string): void {
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
  }

  function reportRow(position: number): HTMLElement {
    return fixture.nativeElement.querySelectorAll('.queue-item')[position - 1];
  }

  function actionButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.queue-actions button'));
  }
});
