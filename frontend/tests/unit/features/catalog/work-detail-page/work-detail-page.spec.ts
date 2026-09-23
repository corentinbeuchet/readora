import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { WorkDetailPage } from '@app/features/catalog/work-detail-page/work-detail-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { ApiResponse } from '@app/core/models/api';
import { Work, WorkFacts } from '@app/core/models/catalog';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { WorkProgress } from '@app/core/models/library';
import { API, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

const WORK: Work = {
  id: 'w-1',
  title: 'Solo Leveling',
  synopsis: 'Hunters',
  type: 'MANHWA',
  status: 'ONGOING',
  author: null,
  demographic: null,
  coverImageUrl: 'https://cdn.readora.com/covers/w-1.webp',
  genres: ['Action'],
  facts: { alternativeTitles: [], artist: null, releaseYear: null, originalLanguage: null, contentRating: null }
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
      pageCount: 10,
      publishedAt: null,
      team: { id: 't-shadow', name: 'Shadow Scans' }
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

    it('Having read every chapter, the series page offers to read it again', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: true, finished: ['c-1', 'c-2', 'c-3'], next: null });

      thenIAmToldIAmUpToDate();
      thenICanContinueWith('Read again', '/read/c-1');
    });

    it('a reader who has read nothing yet starts from chapter 1', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: false, finished: [], next: 'c-1' });

      thenICanContinueWith('Start reading', '/read/c-1');
      thenIAmNotToldIAmUpToDate();
    });

    it('a bookmark whose chapter is gone does not hide the reading button', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: false, finished: [], next: 'c-1', bookmark: { chapterId: null, page: 1 } });

      thenICanContinueWith('Start reading', '/read/c-1');
    });

    it('A saved page in a chapter I already finished does not hide the next chapter', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: true, finished: ['c-1', 'c-2'], next: 'c-3', bookmark: { chapterId: 'c-2', page: 4 } });

      thenICanContinueWith('Continue with chapter 3', '/read/c-3');
    });

    it('a saved page in a chapter I have not finished is where I continue', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: true, finished: ['c-1'], next: 'c-2', bookmark: { chapterId: 'c-2', page: 4 } });

      thenICanContinueWith('Continue reading (page 4)', '/read/c-2?page=4');
    });

    it('Each chapter of a series names the team that translated it', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: false, finished: [], next: 'c-1' });

      thenTheRowNamesTheTeam(3, 'Shadow Scans');
    });

    it('a chapter finished in the version of one team is read in the version of the other team too', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: true, finished: ['c-1'], next: 'c-2', otherVersions: [{ id: 'c-1-moon', number: '1', team: 'Moon Scans' }] });

      thenTheRowsAre(['Ch. 1', 'Ch. 2', 'Ch. 3']);
      thenRowIsRead(1);
      thenRowAlsoOffersTheVersionBy(1, 'Moon Scans');
    });

    it('Translated by lists each team', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: false, finished: [], next: 'c-1', otherVersions: [{ id: 'c-1-moon', number: '1', team: 'Moon Scans' }] });

      thenTranslatedByLists([
        { team: 'Shadow Scans', chapters: '3 chapters', href: '/teams/t-shadow' },
        { team: 'Moon Scans', chapters: '1 chapter', href: '/teams/t-moon-scans' }
      ]);
    });

    it('Series facts on the series page', async () => {
      await givenIAmOnTheWorkPage({
        inLibrary: false,
        finished: [],
        next: 'c-1',
        facts: { alternativeTitles: ['Na Honjaman Level Up'], artist: 'DUBU', releaseYear: 2018, originalLanguage: 'KOREAN', contentRating: null }
      });

      thenTheFactsAre([
        { fact: 'Other titles', values: ['Na Honjaman Level Up'] },
        { fact: 'Artist', values: ['DUBU'] },
        { fact: 'First published', values: ['2018'] },
        { fact: 'Original language', values: ['Korean'] }
      ]);
    });

    it('another version of the first chapter has nothing before it to mark as read', async () => {
      await givenIAmOnTheWorkPage({ inLibrary: true, finished: [], next: 'c-1', otherVersions: [{ id: 'c-1-moon', number: '1', team: 'Moon Scans' }] });

      thenMarkPreviousIsOfferedBefore([2, 3]);
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
    async function givenIAmOnTheWorkPage(state: {
      inLibrary: boolean;
      finished: string[];
      next: string | null;
      /** The saved page; `chapterId: null` when its chapter was deleted. Without it, the bookmark lookup answers 404. */
      bookmark?: { chapterId: string | null; page: number };
      otherVersions?: { id: string; number: string; team: string }[];
      facts?: WorkFacts;
    }): Promise<void> {
      const versions = (state.otherVersions ?? []).map((v) => ({ ...CHAPTERS[0], id: v.id, chapterNumber: v.number, team: { id: `t-${v.team.toLowerCase().replaceAll(' ', '-')}`, name: v.team } }));
      // The API lists versions of a number next to each other, the first published first.
      const listed = [...CHAPTERS, ...versions].sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));
      await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
      fixture = TestBed.createComponent(WorkDetailPage);
      fixture.componentRef.setInput('workId', WORK.id);
      await settle(fixture);
      http.expectOne(`${API}/works/${WORK.id}`).flush(ok({ ...WORK, facts: state.facts ?? WORK.facts }));
      http.expectOne(`${API}/works/${WORK.id}/chapters`).flush(ok(listed));
      // Only this series' library entry is fetched; 404 = not in my library.
      const entry = http.expectOne(`${API}/library/${WORK.id}`);
      if (state.inLibrary) {
        entry.flush(ok({ workId: WORK.id, status: 'READING', addedAt: '', updatedAt: '', newChapterNotifications: true }));
      } else {
        entry.flush(fail('Not found'), { status: 404, statusText: 'Not Found' });
      }
      http.expectOne(`${API}/reading/works/${WORK.id}`).flush(ok(progressOf(state.finished, state.next)));
      const bookmark = http.expectOne(`${API}/bookmarks/${WORK.id}`);
      if (state.bookmark) {
        bookmark.flush(ok({ workId: WORK.id, lastReadChapterId: state.bookmark.chapterId, lastReadPageIndex: state.bookmark.page, status: 'READING', updatedAt: '' }));
      } else {
        bookmark.flush(fail('Not found'), { status: 404, statusText: 'Not Found' });
      }
      await settle(fixture);
    }

    function thenTheFactsAre(expected: { fact: string; values: string[] }[]): void {
      const facts: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('app-work-fact-list .fact'));
      expect(
        facts.map((fact) => ({
          fact: fact.querySelector('dt')!.textContent!.trim(),
          values: Array.from(fact.querySelectorAll('dd')).map((value) => value.textContent!.trim())
        }))
      ).toEqual(expected);
    }

    /** In this series chapter `c-N` is the only version of number N. */
    function progressOf(finished: string[], next: string | null): WorkProgress {
      const number = (id: string): string => id.replace('c-', '');
      return {
        workId: WORK.id,
        finishedChapterIds: finished,
        finishedChapterNumbers: finished.map(number),
        nextChapterNumber: next && number(next),
        nextChapterId: next
      };
    }

    async function whenIMarkTheChaptersBeforeAsRead(chapter: number, progress: { nowFinished: string[]; next: string }): Promise<void> {
      markPreviousButton(chapter)!.click();
      lastRequest = http.expectOne(`${API}/reading/chapters/c-${chapter}/read-up-to`);
      lastRequest.flush(ok(progressOf(progress.nowFinished, progress.next)));
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

    function thenMarkPreviousIsOfferedBefore(chapters: number[]): void {
      expect(markPreviousButtons().map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual(
        chapters.map((n) => `Mark all previous as read (before chapter ${n})`)
      );
    }

    function thenTheRowsAre(numbers: string[]): void {
      const shown: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.chapter-number'));
      expect(shown.map((el) => el.textContent!.trim())).toEqual(numbers);
    }

    function thenRowIsRead(row: number): void {
      expect(chapterLink(row).classList).toContain('chapter-read');
    }

    function thenRowAlsoOffersTheVersionBy(row: number, team: string): void {
      expect(fixture.nativeElement.querySelectorAll('.chapter-row')[row - 1].querySelector('.version-list a').textContent).toContain(team);
    }

    function thenTranslatedByLists(expected: { team: string; chapters: string; href: string }[]): void {
      const teams: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('app-work-teams .team'));
      expect(
        teams.map((team) => ({
          team: team.querySelector('a')!.textContent!.trim(),
          chapters: team.querySelector('.team-count')!.textContent!.trim(),
          href: team.querySelector('a')!.getAttribute('href')
        }))
      ).toEqual(expected);
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

    function thenIAmToldIAmUpToDate(): void {
      expect(fixture.nativeElement.querySelector('.work-actions').textContent).toContain("You're up to date: you read every chapter.");
    }

    function thenIAmNotToldIAmUpToDate(): void {
      expect(fixture.nativeElement.querySelector('.work-actions').textContent).not.toContain('up to date');
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

    function thenTheRowNamesTheTeam(chapter: number, team: string): void {
      expect(chapterLink(chapter).querySelector('.chapter-team')!.textContent!.trim()).toBe(`by ${team}`);
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

  async function whenIOpenTheWorkPage(answers: { chapters: ApiResponse<unknown> }): Promise<void> {
    fixture = TestBed.createComponent(WorkDetailPage);
    fixture.componentRef.setInput('workId', WORK.id);
    await settle(fixture);
    http.expectOne(`${API}/works/${WORK.id}`).flush(ok(WORK));
    http.expectOne(`${API}/works/${WORK.id}/chapters`).flush(answers.chapters);
    await settle(fixture);
  }


  function thenTheChapterListShowsTheError(message: string): void {
    expect(fixture.nativeElement.querySelector('.chapters [role="alert"]').textContent).toContain(message);
  }

  function thenIDoNotSee(text: string): void {
    expect(fixture.nativeElement.textContent).not.toContain(text);
  }
});
