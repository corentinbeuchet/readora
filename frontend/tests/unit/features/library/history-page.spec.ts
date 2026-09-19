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
    await signIn(TestBed.inject(AuthStore), http, READER);
    fixture = TestBed.createComponent(HistoryPage);
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('lists the last series read, newest first, each with a Continue link to the last chapter', async () => {
    http.expectOne(`${API}/reading/history`).flush(ok([item('op', 'One Piece', 'op-2', '2', '2026-09-10T10:00:00Z'), item('sl', 'Solo Leveling', 'sl-3', '3', '2026-09-09T10:00:00Z')]));
    await settle(fixture);

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.history-item'));
    expect(rows.map((r) => r.querySelector('.history-title')?.textContent?.trim())).toEqual(['One Piece', 'Solo Leveling']);
    const continueLink = rows[0].querySelector<HTMLAnchorElement>('a.btn-primary')!;
    expect(continueLink.getAttribute('href')).toBe('/read/op-2');
    expect(continueLink.getAttribute('aria-label')).toBe('Continue One Piece, chapter 2');
  });

  it('invites to browse when nothing was read, and offers a retry on errors', async () => {
    http.expectOne(`${API}/reading/history`).flush(fail('down'));
    await settle(fixture);
    fixture.nativeElement.querySelector('[role="alert"] button').click();
    await settle(fixture);
    http.expectOne(`${API}/reading/history`).flush(ok([]));
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain("You haven't read anything yet.");
  });
});
