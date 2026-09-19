import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { WorkDetailPage } from '@app/features/catalog/work-detail-page/work-detail-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { ApiResponse, Work } from '@app/core/models/readora.models';
import { givenIAmSignedInWith, mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

const WORK: Work = {
  id: 'w-1',
  title: 'Solo Leveling',
  synopsis: 'Hunters',
  type: 'MANHWA',
  status: 'ONGOING',
  coverImageUrl: 'https://cdn.readora.com/covers/w-1.webp',
  genres: ['Action']
};

describe('WorkDetailPage', () => {
  let fixture: ComponentFixture<WorkDetailPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkDetailPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // The ratings section (its own spec) loads with the page.
    http.match((r) => r.url.endsWith('/lists/mine')).forEach((r) => r.flush(ok([])));
    http.match((r) => /\/works\/[^/]+\/(ratings|reviews|rating\/mine)$/.test(r.url)).forEach((r) =>
      r.flush(ok(r.request.url.endsWith('ratings') ? { average: 0, count: 0 } : []))
    );
    http.verify();
  });

  it('"Continue reading" restores the saved page via ?page=N', async () => {
    await givenIAmSignedInWith(['BOOKMARK_READ', 'BOOKMARK_WRITE']);

    await whenIOpenTheWorkPage({ chapters: ok([]), bookmark: { chapterId: 'chap-7', page: 5 } });

    thenTheFirstActionIs('Continue reading (page 5)', '/read/chap-7?page=5');
  });

  it('shows an error (not "no chapters") when the chapter list answers success:false', async () => {
    await whenIOpenTheWorkPage({ chapters: fail('Chapters unavailable') });

    thenTheChapterListShowsTheError('The chapter list could not be loaded.');
    thenIDoNotSee('No chapters have been published yet.');
  });

  /** Model for component tests: given/when/then methods (frontend-component-tests skill). */
  describe('library and read markers (LIBRARY_USE)', () => {
    const CHAPTERS = ['1', '2', '3'].map((n) => ({
      id: `c-${n}`,
      workId: WORK.id,
      chapterNumber: n,
      title: `Chapter ${n}`,
      status: 'PUBLISHED' as const,
      pageCount: 10
    }));
    let lastRequest: TestRequest;

    it('dims finished chapters, highlights the next one and continues from it', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: true, finished: ['c-1'], next: 'c-2' });

      thenChapterIsRead(1);
      thenChapterIsNextUp(2);
      thenChapterIsUnread(3);
      thenICanContinueWith('Continue with chapter 2', '/read/c-2');
      thenMyLibraryStatusIs('READING');
    });

    it('Marking all previous chapters as read', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: true, finished: ['c-1'], next: 'c-2' });
      thenICanMarkPreviousChaptersOnlyBefore(3);

      await whenIMarkTheChaptersBeforeAsRead(3, { nowFinished: ['c-1', 'c-2'], next: 'c-3' });

      thenTheRequestWas('POST', `${API}/reading/chapters/c-3/read-up-to`);
      thenChapterIsRead(2);
      thenChapterIsNextUp(3);
      thenICanNoLongerMarkPreviousChapters();
    });

    it('adds the series to the library, then removes it', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: false, finished: [], next: 'c-1' });

      await whenIAddTheSeriesToMyLibrary({ savedAs: 'READING' });

      thenTheRequestWas('PUT', `${API}/library/${WORK.id}`, {});
      thenMyLibraryStatusIs('READING');

      await whenIRemoveTheSeriesFromMyLibrary();

      thenTheSeriesIsNotInMyLibrary();
    });

    /** A free reader on a 3-chapter series; the library and read state the test checks are its arguments. */
    async function givenIAmOnTheWorkPage(state: { inLibrary: boolean; finished: string[]; next: string }): Promise<void> {
      await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
      fixture = TestBed.createComponent(WorkDetailPage);
      fixture.componentRef.setInput('workId', WORK.id);
      await settle(fixture);
      http.expectOne(`${API}/works/${WORK.id}`).flush(ok(WORK));
      http.expectOne(`${API}/works/${WORK.id}/chapters`).flush(ok(CHAPTERS));
      // Only this series' library entry is fetched; 404 = not in my library.
      const entry = http.expectOne(`${API}/library/${WORK.id}`);
      if (state.inLibrary) {
        entry.flush(ok({ workId: WORK.id, status: 'READING', addedAt: '', updatedAt: '', newChapterNotifications: true }));
      } else {
        entry.flush(fail('Not found'), { status: 404, statusText: 'Not Found' });
      }
      http.expectOne(`${API}/reading/works/${WORK.id}`).flush(ok({ workId: WORK.id, finishedChapterIds: state.finished, nextChapterId: state.next }));
      await settle(fixture);
    }

    async function whenIMarkTheChaptersBeforeAsRead(chapter: number, progress: { nowFinished: string[]; next: string }): Promise<void> {
      markPreviousButton(chapter)!.click();
      lastRequest = http.expectOne(`${API}/reading/chapters/c-${chapter}/read-up-to`);
      lastRequest.flush(ok({ workId: WORK.id, finishedChapterIds: progress.nowFinished, nextChapterId: progress.next }));
      await settle(fixture);
    }

    async function whenIAddTheSeriesToMyLibrary(answer: { savedAs: string }): Promise<void> {
      button('Add to library').click();
      lastRequest = http.expectOne(`${API}/library/${WORK.id}`);
      lastRequest.flush(ok({ workId: WORK.id, status: answer.savedAs, addedAt: '', updatedAt: '' }));
      await settle(fixture);
    }

    async function whenIRemoveTheSeriesFromMyLibrary(): Promise<void> {
      button('Remove from library').click();
      lastRequest = http.expectOne(`${API}/library/${WORK.id}`);
      lastRequest.flush(null, { status: 204, statusText: 'No Content' });
      await settle(fixture);
    }

    function thenChapterIsRead(chapter: number): void {
      expect(chapterLink(chapter).classList).toContain('chapter-read');
      expect(chapterLink(chapter).textContent).toContain('✓ Read');
    }

    function thenChapterIsUnread(chapter: number): void {
      expect(chapterLink(chapter).classList).not.toContain('chapter-read');
    }

    function thenChapterIsNextUp(chapter: number): void {
      expect(chapterLink(chapter).classList).toContain('chapter-next');
      expect(chapterLink(chapter).textContent).toContain('Next up');
    }

    function thenICanContinueWith(label: string, href: string): void {
      const primary: HTMLAnchorElement = fixture.nativeElement.querySelector('.work-actions a.btn-primary');
      expect(primary.textContent).toContain(label);
      expect(primary.getAttribute('href')).toBe(href);
    }

    function thenMyLibraryStatusIs(status: string): void {
      expect(fixture.nativeElement.querySelector('.library-status select')?.value).toBe(status);
    }

    function thenTheSeriesIsNotInMyLibrary(): void {
      expect(fixture.nativeElement.querySelector('.library-status')).toBeNull();
      expect(button('Add to library')).toBeDefined();
    }

    /** Chapter 1 has nothing before it; chapter 2 only has read chapters before it. */
    function thenICanMarkPreviousChaptersOnlyBefore(chapter: number): void {
      expect(markPreviousButtons()).toHaveLength(1);
      expect(markPreviousButton(chapter)).toBeDefined();
    }

    function thenICanNoLongerMarkPreviousChapters(): void {
      expect(markPreviousButtons()).toHaveLength(0);
    }

    function thenTheRequestWas(method: string, url: string, body?: unknown): void {
      expect(lastRequest.request.method).toBe(method);
      expect(lastRequest.request.url).toBe(url);
      if (body !== undefined) expect(lastRequest.request.body).toEqual(body);
    }

    function chapterLink(chapter: number): HTMLElement {
      return fixture.nativeElement.querySelectorAll('.chapter-link')[chapter - 1];
    }

    function markPreviousButtons(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('.mark-previous'));
    }

    function markPreviousButton(chapter: number): HTMLButtonElement | undefined {
      return markPreviousButtons().find((b) => b.textContent?.includes(`before chapter ${chapter}`));
    }

    function button(label: string): HTMLButtonElement {
      return Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
    }
  });

  /** The bookmark request is only made (and answered) for a reader who has one to restore. */
  async function whenIOpenTheWorkPage(answers: { chapters: ApiResponse<unknown>; bookmark?: { chapterId: string; page: number } }): Promise<void> {
    fixture = TestBed.createComponent(WorkDetailPage);
    fixture.componentRef.setInput('workId', WORK.id);
    await settle(fixture);
    http.expectOne(`${API}/works/${WORK.id}`).flush(ok(WORK));
    http.expectOne(`${API}/works/${WORK.id}/chapters`).flush(answers.chapters);
    if (answers.bookmark) {
      // Only this series' bookmark is fetched, not the whole list.
      http
        .expectOne(`${API}/bookmarks/${WORK.id}`)
        .flush(ok({ workId: WORK.id, lastReadChapterId: answers.bookmark.chapterId, lastReadPageIndex: answers.bookmark.page, status: 'READING', updatedAt: '' }));
    }
    await settle(fixture);
  }

  function thenTheFirstActionIs(label: string, href: string): void {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.work-actions a');
    expect(link.textContent).toContain(label);
    expect(link.getAttribute('href')).toBe(href);
  }

  function thenTheChapterListShowsTheError(message: string): void {
    expect(fixture.nativeElement.querySelector('.chapters [role="alert"]').textContent).toContain(message);
  }

  function thenIDoNotSee(text: string): void {
    expect(fixture.nativeElement.textContent).not.toContain(text);
  }
});
