import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HistoryPage } from '@app/features/library/history-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { HistoryItem } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { settle } from '../../test-utils';

const API = environment.apiUrl;
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
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    await signIn(TestBed.inject(AuthStore), http, READER);
    fixture = TestBed.createComponent(HistoryPage);
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('lists the last series read, newest first, each with a Continue link to the last chapter', async () => {
    http.expectOne(`${API}/reading/history`).flush({
      success: true,
      data: [item('op', 'One Piece', 'op-2', '2', '2026-09-10T10:00:00Z'), item('sl', 'Solo Leveling', 'sl-3', '3', '2026-09-09T10:00:00Z')],
      error: null
    });
    await settle(fixture);

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.history-item'));
    expect(rows.map((r) => r.querySelector('.history-title')?.textContent?.trim())).toEqual(['One Piece', 'Solo Leveling']);
    const continueLink = rows[0].querySelector<HTMLAnchorElement>('a.btn-primary')!;
    expect(continueLink.getAttribute('href')).toBe('/read/op-2');
    expect(continueLink.getAttribute('aria-label')).toBe('Continue One Piece, chapter 2');
  });

  it('invites to browse when nothing was read, and offers a retry on errors', async () => {
    http.expectOne(`${API}/reading/history`).flush({ success: false, data: null, error: 'down' });
    await settle(fixture);
    fixture.nativeElement.querySelector('[role="alert"] button').click();
    await settle(fixture);
    http.expectOne(`${API}/reading/history`).flush({ success: true, data: [], error: null });
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain("You haven't read anything yet.");
  });
});
