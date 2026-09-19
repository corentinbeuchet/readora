import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { WorkDetailPage } from '@app/features/catalog/work-detail-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { Work } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting, settle } from '../../test-utils';

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
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['BOOKMARK_READ', 'BOOKMARK_WRITE'] }));
    fixture = TestBed.createComponent(WorkDetailPage);
    fixture.componentRef.setInput('workId', WORK.id);
    await settle(fixture);

    http.expectOne(`${API}/works/${WORK.id}`).flush(ok(WORK));
    http.expectOne(`${API}/works/${WORK.id}/chapters`).flush(ok([]));
    // Only this series' bookmark is fetched, not the whole list.
    http.expectOne(`${API}/bookmarks/${WORK.id}`).flush(ok({ workId: WORK.id, lastReadChapterId: 'chap-7', lastReadPageIndex: 5, status: 'READING', updatedAt: '' }));
    await settle(fixture);

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.work-actions a');
    expect(link.textContent).toContain('Continue reading (page 5)');
    expect(link.getAttribute('href')).toBe('/read/chap-7?page=5');
  });

  it('shows an error (not "no chapters") when the chapter list answers success:false', async () => {
    fixture = TestBed.createComponent(WorkDetailPage);
    fixture.componentRef.setInput('workId', WORK.id);
    await settle(fixture);

    http.expectOne(`${API}/works/${WORK.id}`).flush(ok(WORK));
    http.expectOne(`${API}/works/${WORK.id}/chapters`).flush(fail('Chapters unavailable'));
    await settle(fixture);

    const alert: HTMLElement = fixture.nativeElement.querySelector('.chapters [role="alert"]');
    expect(alert.textContent).toContain('The chapter list could not be loaded.');
    expect(fixture.nativeElement.textContent).not.toContain('No chapters have been published yet.');
  });

  /** Given/When/Then model for component tests (see the frontend-component-tests skill). */
  describe('library and read markers (LIBRARY_USE)', () => {
    const CHAPTERS = ['1', '2', '3'].map((n) => ({
      id: `c-${n}`,
      workId: WORK.id,
      chapterNumber: n,
      title: `Chapter ${n}`,
      status: 'PUBLISHED' as const,
      pageCount: 10
    }));

    /**
     * A free reader on the page of a 3-chapter series. What the tests assert on is passed in: whether the series is
     * in the library, which chapters are finished and which one is next.
     */
    async function givenWorkPage(state: { inLibrary: boolean; finished: string[]; next: string }): Promise<void> {
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

    const chapterLinks = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.chapter-link'));
    const markPreviousButtons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('.mark-previous'));
    const button = (label: string): HTMLButtonElement =>
      Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
    const libraryStatus = (): string | undefined => fixture.nativeElement.querySelector('.library-status select')?.value;

    it('dims finished chapters, highlights the next one and continues from it', async () => {
      // Given
      await givenWorkPage({ inLibrary: true, finished: ['c-1'], next: 'c-2' });

      // Then
      expect(chapterLinks()[0].classList).toContain('chapter-read');
      expect(chapterLinks()[0].textContent).toContain('✓ Read');
      expect(chapterLinks()[1].classList).toContain('chapter-next');
      expect(chapterLinks()[1].textContent).toContain('Next up');
      expect(chapterLinks()[2].classList).not.toContain('chapter-read');
      const primary: HTMLAnchorElement = fixture.nativeElement.querySelector('.work-actions a.btn-primary');
      expect(primary.textContent).toContain('Continue with chapter 2');
      expect(primary.getAttribute('href')).toBe('/read/c-2');
      expect(libraryStatus()).toBe('READING');
    });

    it('Marking all previous chapters as read', async () => {
      // Given chapter 1 read: chapter 2 only has read chapters before it, so only chapter 3 offers the action
      await givenWorkPage({ inLibrary: true, finished: ['c-1'], next: 'c-2' });
      expect(markPreviousButtons()).toHaveLength(1);
      expect(markPreviousButtons()[0].textContent).toContain('before chapter 3');

      // When
      markPreviousButtons()[0].click();
      const request = http.expectOne(`${API}/reading/chapters/c-3/read-up-to`);
      request.flush(ok({ workId: WORK.id, finishedChapterIds: ['c-1', 'c-2'], nextChapterId: 'c-3' }));
      await settle(fixture);

      // Then
      expect(request.request.method).toBe('POST');
      expect(chapterLinks()[1].classList).toContain('chapter-read');
      expect(chapterLinks()[2].classList).toContain('chapter-next');
      expect(markPreviousButtons()).toHaveLength(0);
    });

    it('adds the series to the library, then removes it', async () => {
      // Given
      await givenWorkPage({ inLibrary: false, finished: [], next: 'c-1' });

      // When
      button('Add to library').click();
      const save = http.expectOne(`${API}/library/${WORK.id}`);
      save.flush(ok({ workId: WORK.id, status: 'READING', addedAt: '', updatedAt: '' }));
      await settle(fixture);

      // Then
      expect(save.request.method).toBe('PUT');
      expect(save.request.body).toEqual({});
      expect(libraryStatus()).toBe('READING');

      // When
      button('Remove from library').click();
      http.expectOne(`${API}/library/${WORK.id}`).flush(null, { status: 204, statusText: 'No Content' });
      await settle(fixture);

      // Then
      expect(libraryStatus()).toBeUndefined();
      expect(button('Add to library')).toBeDefined();
    });
  });
});
