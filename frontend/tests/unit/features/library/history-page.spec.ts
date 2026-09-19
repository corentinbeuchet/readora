import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HistoryPage } from '@app/features/library/history-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { HistoryItem } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting, settle } from '../../test-utils';

const READER = mockUser({ permissions: ['LIBRARY_USE'] });

function item(id: string, title: string, chapterId: string, chapterNumber: string, readAt: string): HistoryItem {
  return {
    work: { id, title, type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: [] },
    lastRead: { chapterId, workId: id, chapterNumber, readAt, finished: false }
  };
}

describe('HistoryPage (US-07 reading history)', () => {
  let fixture: ComponentFixture<HistoryPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the last series read, newest first, each with a Continue link to the last chapter', async () => {
    await whenIOpenMyHistory([item('op', 'One Piece', 'op-2', '2', '2026-09-10T10:00:00Z'), item('sl', 'Solo Leveling', 'sl-3', '3', '2026-09-09T10:00:00Z')]);

    thenTheSeriesListedAre(['One Piece', 'Solo Leveling']);
    thenRowContinuesTo(1, '/read/op-2');
    thenRowContinueLinkIsLabelled(1, 'Continue One Piece, chapter 2');
  });

  it('invites to browse when nothing was read, and offers a retry on errors', async () => {
    await givenMyHistoryFailsToLoad();

    await whenIRetry({ history: [] });

    thenICanSee("You haven't read anything yet.");
  });

  async function givenMyHistoryFailsToLoad(): Promise<void> {
    await openTheHistory();
    http.expectOne(`${API}/reading/history`).flush(fail('down'));
    await settle(fixture);
  }

  async function whenIOpenMyHistory(history: HistoryItem[]): Promise<void> {
    await openTheHistory();
    http.expectOne(`${API}/reading/history`).flush(ok(history));
    await settle(fixture);
  }

  async function whenIRetry(answer: { history: HistoryItem[] }): Promise<void> {
    fixture.nativeElement.querySelector('[role="alert"] button').click();
    await settle(fixture);
    http.expectOne(`${API}/reading/history`).flush(ok(answer.history));
    await settle(fixture);
  }

  function thenTheSeriesListedAre(titles: string[]): void {
    expect(rows().map((r) => r.querySelector('.history-title')?.textContent?.trim())).toEqual(titles);
  }

  function thenRowContinuesTo(position: number, href: string): void {
    expect(continueLink(position).getAttribute('href')).toBe(href);
  }

  function thenRowContinueLinkIsLabelled(position: number, label: string): void {
    expect(continueLink(position).getAttribute('aria-label')).toBe(label);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  async function openTheHistory(): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, READER);
    fixture = TestBed.createComponent(HistoryPage);
    await settle(fixture);
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.history-item'));
  }

  function continueLink(position: number): HTMLAnchorElement {
    return rows()[position - 1].querySelector<HTMLAnchorElement>('a.btn-primary')!;
  }
});
