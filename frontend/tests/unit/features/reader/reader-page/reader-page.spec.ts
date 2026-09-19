import { ComponentFixture, DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { PROGRESS_SYNC_DEBOUNCE_MS, ReaderPage, ZEN_CONTROLS_HIDE_MS } from '@app/features/reader/reader-page/reader-page';
import { ReaderState } from '@app/features/reader/reader-page/reader-state';
import { ReaderPreferencesStore } from '@app/features/reader/reader-page/reader-preferences-store';
import { LayoutStore } from '@app/core/layout/layout-store';
import { Chapter } from '@app/core/models/chapter';
import { ChapterComment } from '@app/core/models/comments';
import { Permission } from '@app/core/models/identity';
import { givenIAmSignedInWith } from '../../../core/auth/auth-fixtures';
import { ANY_URL, API, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

const MOCK_CHAPTER: Chapter = {
  id: 'chap-10-uuid',
  workId: 'solo-uuid',
  chapterNumber: '10',
  title: 'Chapter 10',
  status: 'PUBLISHED',
  pages: [
    { pageNumber: 1, storageKey: 'p1.webp', cdnUrl: 'https://cdn.readora.com/p1.webp' },
    { pageNumber: 2, storageKey: 'p2.webp', cdnUrl: 'https://cdn.readora.com/p2.webp' },
    { pageNumber: 3, storageKey: 'p3.webp', cdnUrl: 'https://cdn.readora.com/p3.webp' }
  ]
};

const PROGRESS_URL = `${API}/bookmarks/${MOCK_CHAPTER.workId}/progress`;
const HISTORY_URL = `${API}/reading/chapters/${MOCK_CHAPTER.id}`;
const FREE: Permission[] = ['COMMENT_WRITE', 'COMMENT_UPVOTE'];
const PREMIUM: Permission[] = ['COMMENT_WRITE', 'BOOKMARK_READ', 'BOOKMARK_WRITE'];

/** The 3-page test chapter with some fields replaced. */
function chapter(overrides: Partial<Chapter>): Chapter {
  return { ...MOCK_CHAPTER, ...overrides };
}

/** A chapter of a given series and format, as the reader endpoint returns it. */
function chapterOf(id: string, workId: string, type: 'MANGA' | 'MANHWA' | 'COMIC'): Chapter {
  return { ...MOCK_CHAPTER, id, workId, work: { id: workId, title: workId, type } };
}

function soloLeveling(chapterNumber: number, links: { previous: string; next: string | null }): Chapter {
  return {
    ...chapterOf(`sl-${chapterNumber}`, 'solo-leveling', 'MANHWA'),
    chapterNumber: `${chapterNumber}`,
    previousChapterId: links.previous,
    nextChapterId: links.next
  };
}

function withPages(base: Chapter, count: number): Chapter {
  return {
    ...base,
    pages: Array.from({ length: count }, (_, i) => ({ pageNumber: i + 1, storageKey: `p${i + 1}`, cdnUrl: `https://cdn.readora.com/p${i + 1}.webp` }))
  };
}

function withPageSizes(base: Chapter, sizes: [number, number][]): Chapter {
  return { ...base, pages: base.pages.map((p, i) => ({ ...p, width: sizes[i][0], height: sizes[i][1] })) };
}

/** The given pages get a `.lite.jpg` copy, the others have none. */
function withLiteCopies(base: Chapter, pageNumbers: number[]): Chapter {
  return {
    ...base,
    pages: base.pages.map((p) => (pageNumbers.includes(p.pageNumber) ? { ...p, liteCdnUrl: p.cdnUrl.replace('.webp', '.webp.lite.jpg') } : p))
  };
}

function withDescription(base: Chapter, pageNumber: number, description: string): Chapter {
  return { ...base, pages: base.pages.map((p) => (p.pageNumber === pageNumber ? { ...p, description } : p)) };
}

function topComment(id: string, author: string, content: string, upvotes: number): ChapterComment {
  return { id, chapterId: MOCK_CHAPTER.id, authorId: `u-${author}`, authorUsername: author, content, depth: 1, isSpoiler: false, upvotes, createdAt: '' };
}

/** Minimal IntersectionObserver double: lets a test report which page crosses the viewport middle. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly observed: Element[] = [];
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  disconnect(): void {
    this.observed.length = 0;
  }
  unobserve(): void {
    /* not used */
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  show(pageIndex: number): void {
    const target = this.observed[pageIndex];
    this.callback([{ target, isIntersecting: true } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  static latest(): FakeIntersectionObserver {
    return FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];
  }
}

describe('ReaderPage (API-driven)', () => {
  let fixture: ComponentFixture<ReaderPage>;
  let stateService: ReaderState;
  let http: HttpTestingController;
  let lastRequest: TestRequest;
  let lastKeyEvent: KeyboardEvent;
  let previousState: ReaderState;
  let previousActiveImage: HTMLImageElement;
  let consoleErrors: ReturnType<typeof vi.spyOn>;
  let frames: Map<number, FrameRequestCallback>;
  let scrollBy: ReturnType<typeof vi.spyOn>;
  let scrollsBeforeFrames: number;

  beforeEach(async () => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    await TestBed.configureTestingModule({
      imports: [ReaderPage],
      providers: [provideRouter(ANY_URL), ...provideHttpTesting()],
      deferBlockBehavior: DeferBlockBehavior.Manual
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReaderPage);
    stateService = fixture.debugElement.injector.get(ReaderState);
  });

  afterEach(() => {
    vi.useRealTimers();
    // Set by the auto-scroll test: jsdom has no layout, so the page is given a height to scroll through.
    delete (document.documentElement as unknown as Record<string, unknown>)['scrollHeight'];
    // Reaching the last page loads the chapter's top comments (own test below).
    // Opening another chapter cancels the previous chapter's request.
    http.match((r) => r.url.endsWith('/top')).filter((r) => !r.cancelled).forEach((r) => r.flush(ok([])));
    http.verify();
  });

  it('loads the chapter from the API and renders all pages in vertical mode', async () => {
    await whenIOpen(MOCK_CHAPTER);

    thenTheOpenChapterIs(MOCK_CHAPTER.id);
    thenTheVerticalFlowHasPages(3);
    thenTheFirstVerticalPageIsNumbered('1');
    thenVerticalImageShows(1, 'https://cdn.readora.com/p1.webp');
    thenTheChapterTitleSays('Chapter 10');
  });

  it('renders single page and navigation in paged mode, without re-fetching the chapter', async () => {
    await givenIAmReading(MOCK_CHAPTER);

    await whenISwitchTo('Paged');

    thenTheChapterWasNotFetchedAgain();
    thenTheActivePageShows('p1.webp');

    await whenIClickNext();

    thenTheActivePageShows('p2.webp');
  });

  it('paged mode moves between pages of different sizes without NgOptimizedImage errors (NG02953)', async () => {
    givenConsoleErrorsAreRecorded();
    await givenIAmReading(withPageSizes(MOCK_CHAPTER, [[800, 1200], [720, 5000], [800, 1150]]));
    await givenIAmInPagedMode();
    givenINoteTheActiveImage();

    await whenIClickNext();

    thenTheActiveImageIsANewElement();
    thenTheActiveImageSizeIs('720', '5000');
    thenNoConsoleErrorMentions('NG02953');
  });

  it('keeps the current page when switching view mode', async () => {
    await givenIAmReading(MOCK_CHAPTER);
    await givenIAmInPagedMode();
    await givenITurnedForward(2);
    thenIAmOnPage(3);

    await whenISwitchTo('Vertical');
    await whenISwitchTo('Paged');

    thenTheChapterWasNotFetchedAgain();
    thenIAmOnPage(3);
    thenThePageIndicatorSays('Page 3 / 3');
  });

  it('tracks the visible page in vertical mode', async () => {
    await givenIAmReading(MOCK_CHAPTER);
    thenTheObserverWatchesPages(3);

    whenPageScrollsIntoView(2);

    thenIAmOnPage(2);
    thenThePageIndicatorSays('Page 2 / 3');
  });

  it('opens on the page given by ?page=N', async () => {
    await whenIOpen(MOCK_CHAPTER, { page: '3' });

    thenIAmOnPage(3);
  });

  it('ignores an invalid ?page value', async () => {
    await whenIOpen(MOCK_CHAPTER, { page: 'abc' });

    thenIAmOnPage(1);
  });

  it('shows an error state (no crash) when the chapter cannot be loaded', async () => {
    await whenIOpenAMissingChapter('unknown');

    thenTheAlertSays('Chapter unavailable');
    thenNoPageImageIsShown();
  });

  it('shows the Premium upsell and never syncs progress for a free reader', async () => {
    await givenIAmSignedInWith(FREE);
    await givenIAmReading(MOCK_CHAPTER);
    givenTimeIsFrozen();
    thenTheSyncHintSays('Go Premium');

    whenPageScrollsIntoView(2);
    await whenTimePasses(PROGRESS_SYNC_DEBOUNCE_MS + 50);

    thenNoBookmarkWasSynced();
  });

  it('does not overwrite the saved bookmark just by opening a chapter', async () => {
    await givenIAmSignedInWith(PREMIUM);
    await givenIAmReading(MOCK_CHAPTER, { page: '2' });
    givenTimeIsFrozen();

    await whenTimePasses(PROGRESS_SYNC_DEBOUNCE_MS * 2);

    thenNoProgressWasSynced();
    thenTheSyncHintSays('Progress is saved automatically');
  });

  it('debounces and syncs reading progress (1-based page) for a PREMIUM reader', async () => {
    await givenIAmSignedInWith(PREMIUM);
    await givenIAmReading(MOCK_CHAPTER);
    await givenIAmInPagedMode();
    givenTimeIsFrozen();

    await whenIClickNext();
    await whenTimePasses(PROGRESS_SYNC_DEBOUNCE_MS - 100);

    thenNoProgressWasSynced();

    await whenTheProgressSyncRuns({ after: 150, answer: 'saved' });

    thenTheRequestMethodWas('PUT');
    thenTheRequestBodyWas({ chapterId: MOCK_CHAPTER.id, pageIndex: 2 });
    thenTheSyncHintSays('Progress saved');
  });

  it('keeps syncing after a failed save (400 / network)', async () => {
    await givenIAmSignedInWith(PREMIUM);
    await givenIAmReading(MOCK_CHAPTER);
    await givenIAmInPagedMode();
    givenTimeIsFrozen();

    await whenIClickNext();
    await whenTheProgressSyncRuns({ after: PROGRESS_SYNC_DEBOUNCE_MS, answer: 'rejected' });

    thenTheSyncHintSays('Could not save progress');

    await whenIClickNext();
    await whenTheProgressSyncRuns({ after: PROGRESS_SYNC_DEBOUNCE_MS, answer: 'network error' });

    thenTheSyncHintSays('Could not save progress');

    await whenIClickPrevious();
    await whenTheProgressSyncRuns({ after: PROGRESS_SYNC_DEBOUNCE_MS, answer: 'saved' });

    thenTheRequestBodyWas({ chapterId: MOCK_CHAPTER.id, pageIndex: 2 });
    thenTheSyncHintSays('Progress saved');
  });

  it('renders pages with NgOptimizedImage: reserved size, first page prioritised, others lazy', async () => {
    await whenIOpen(MOCK_CHAPTER);

    thenVerticalImageIsPrioritised(1);
    thenVerticalImageIsLazy(2);
    thenVerticalImageIsNotPrioritised(2);
    thenTheVerticalImageSizesAre([
      ['800', '1200'],
      ['800', '1200'],
      ['800', '1200']
    ]);
  });

  it('gives every reader visit its own state (nothing carried over from the previous visit)', async () => {
    await givenIAmReading(MOCK_CHAPTER);
    thenTheOpenChapterIs(MOCK_CHAPTER.id);

    whenILeaveAndOpenTheReaderAgain();

    thenTheReaderStateIsNew();
    thenNoChapterIsOpen();
  });

  it('defers the comments section: placeholder first, thread loaded only once the block renders', async () => {
    await givenIAmReading(MOCK_CHAPTER);
    thenTheCommentsPlaceholderIsShown();
    thenTheCommentsAreNotRendered();
    thenTheCommentsWereNotFetched();

    await whenTheCommentsBlockRenders();

    thenTheCommentsAreRendered();
  });

  it('Reading manga right to left', async () => {
    await givenIAmReading(chapterOf('sl-1', 'solo-leveling', 'MANHWA'));
    await givenIAmInPagedMode();
    thenTheNavButtonsAre(['← Prev', 'Next →']);

    await whenIReadRightToLeft();

    thenToolbarButtonIsPressed('Right to left', true);
    thenTheNavButtonsAre(['← Next', 'Prev →']);

    whenIPress('ArrowLeft');

    thenIAmOnPage(2);

    whenIPress('ArrowRight');

    thenIAmOnPage(1);

    whenISwipe(+120);

    thenIAmOnPage(2);
    thenThePageSliderDirectionIs('rtl');
  });

  it('The reader opens in the right mode for the format', async () => {
    await whenIOpen(chapterOf('sl-1', 'solo-leveling', 'MANHWA'));

    thenTheViewModeIs('VERTICAL');

    await whenIOpen(chapterOf('op-1', 'one-piece', 'MANGA'));

    thenTheViewModeIs('PAGED');
    thenTheDirectionIs('RTL');
    thenTheNavButtonsAre(['← Next', 'Prev →']);
  });

  it('The reader remembers my mode for each series', async () => {
    await givenIAmReading(chapterOf('op-1', 'one-piece', 'MANGA'));

    await whenISwitchTo('Vertical');
    await whenIOpen(chapterOf('op-2', 'one-piece', 'MANGA'));

    thenTheViewModeIs('VERTICAL');

    await whenIOpen(chapterOf('sl-1', 'solo-leveling', 'MANHWA'));

    thenTheViewModeIs('VERTICAL');

    await whenISwitchTo('Paged');
    await whenIOpen(chapterOf('op-3', 'one-piece', 'MANGA'));

    thenTheViewModeIs('VERTICAL');

    await whenIOpen(chapterOf('sl-2', 'solo-leveling', 'MANHWA'));

    thenTheViewModeIs('PAGED');
  });

  it('Turning pages with the keyboard or a click', async () => {
    await givenIAmReading(withPages(MOCK_CHAPTER, 6));
    await givenIAmInPagedMode();

    whenIPress('ArrowRight');

    thenTheKeyWasHandledByTheReader(true);

    whenIPress(' ');
    whenIPress('PageDown');

    thenIAmOnPage(4);

    whenIPress('PageUp');
    whenIPress(' ', { shiftKey: true });

    thenIAmOnPage(2);

    whenITapTheRightSide();

    thenIAmOnPage(3);

    whenITapTheLeftSide();

    thenIAmOnPage(2);

    whenISwipe(-120);

    thenIAmOnPage(3);

    whenISwipe(-20); // too short: a tap on the left zone, which goes back

    thenIAmOnPage(2);
  });

  it('keys are ignored while typing, with modifiers, and in vertical mode', async () => {
    await givenIAmReading(MOCK_CHAPTER);

    whenIPress('ArrowRight');

    thenIAmOnPage(1);

    await whenISwitchTo('Paged');
    whenIPressInATextField('ArrowRight');

    thenTheKeyWasHandledByTheReader(false);

    whenIPress('ArrowRight', { ctrlKey: true });

    thenIAmOnPage(1);
  });

  it('Pages turn instantly', async () => {
    await givenIAmReading(withPages(MOCK_CHAPTER, 6), { page: '3' });
    await givenIAmInPagedMode();
    thenThePreloadedImagesAre(['https://cdn.readora.com/p4.webp', 'https://cdn.readora.com/p5.webp']);

    await whenIClickNext();

    thenTheActivePageShows('p4.webp');
    thenThePreloadedImagesAre(['https://cdn.readora.com/p5.webp', 'https://cdn.readora.com/p6.webp']);
  });

  it('Seeing where I am and jumping to a page', async () => {
    await givenIAmReading(withPages(MOCK_CHAPTER, 20), { page: '8' });
    thenTheProgressPercentIs('40%');
    thenThePageSliderSays('Page 8 of 20');

    whenIDragThePageSliderTo(20);

    thenIAmOnPage(20);
    thenTheProgressPercentIs('100%');
  });

  it('shows previous / next chapter and the chapter list at the end of a chapter', async () => {
    await givenIAmReading(soloLeveling(5, { previous: 'sl-4', next: 'sl-6' }));
    await givenIAmInPagedMode();
    thenThereIsNoChapterEnd();

    await whenIReachTheLastPage();

    thenTheChapterEndLinksAre([
      ['Previous chapter', '/read/sl-4'],
      ['Chapter list', '/works/solo-leveling#chapters'],
      ['Next chapter', '/read/sl-6']
    ]);

    await whenIOpen(soloLeveling(6, { previous: 'sl-5', next: null }));
    await whenISwitchTo('Vertical');

    thenTheChapterEndSays("You're up to date");
  });

  it('Opening the chapter list inside the reader', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIAmReading(chapter({ id: 'c-5', chapterNumber: '5' }));
    givenMyVisitWasRecorded('c-5');
    thenTheChapterListIsHidden();
    thenTheChapterListWasNotFetched();

    await whenIOpenTheChapterList({ chapters: 5, finished: ['c-1', 'c-2', 'c-3', 'c-4'], next: 'c-5' });

    thenToolbarButtonIsExpanded('Chapters', true);
    thenTheChapterListHasEntries(5);
    thenTheChaptersMarkedReadLinkTo(['/read/c-1', '/read/c-2', '/read/c-3', '/read/c-4']);
    thenChapterListEntryIsCurrent(5);
    thenChapterListEntryLinksTo(2, '/read/c-2');

    whenIPress('Escape');

    thenToolbarButtonIsExpanded('Chapters', false);
    thenFocusIsOnToolbarButton('Chapters');

    await whenIChooseFromTheChapterList(2);

    thenToolbarButtonIsExpanded('Chapters', false);
    thenIAmOn('/read/c-2');
  });

  it('Data saver swaps in the lighter copies (kept for next chapters), falling back to full images', async () => {
    await givenIAmReading(withLiteCopies(MOCK_CHAPTER, [1, 2]));
    thenTheVerticalImagesAre(['https://cdn.readora.com/p1.webp', 'https://cdn.readora.com/p2.webp', 'https://cdn.readora.com/p3.webp']);

    whenIOpenTheSettings();
    whenITick('Data saver');

    thenTheVerticalImagesAre([
      'https://cdn.readora.com/p1.webp.lite.jpg',
      'https://cdn.readora.com/p2.webp.lite.jpg',
      'https://cdn.readora.com/p3.webp'
    ]);
    thenDataSaverIsRemembered(true);
    thenTheChapterWasNotFetchedAgain();
  });

  it('Reading with a screen reader', async () => {
    await givenIAmReading(withDescription(MOCK_CHAPTER, 3, 'Jinwoo stands alone in the dungeon'));
    await givenIAmInPagedMode();
    thenTheAnnouncementIs('Page 1 of 3');
    thenThePageIndicatorIsHiddenFromScreenReaders();

    await whenIReachTheLastPage();

    thenTheAnnouncementIs('Page 3 of 3');
    thenTheShownPageIsDescribedAs('Page 3: Jinwoo stands alone in the dungeon');

    await whenIClickPrevious();

    thenTheShownPageIsDescribedAs('Page 2');
  });

  it('Seeing the best comments at the end of a chapter', async () => {
    await givenIAmReading(MOCK_CHAPTER);
    await givenIAmInPagedMode();
    thenTheTopCommentsWereNotFetched();

    await whenIReachTheLastPage();
    await whenTheTopCommentsArrive({ limit: 3 }, [topComment('k1', 'aoi', 'That ending!', 12), topComment('k2', 'kenji', 'Art is gorgeous', 4)]);

    thenTheTopCommentsAre(['That ending!', 'Art is gorgeous']);
    thenTopCommentAuthorLinksTo(1, '/u/aoi');

    await whenIGoBackAPageAndForwardAgain();

    thenTheTopCommentsWereNotFetched();
    thenThereAreTopComments(2);
  });

  it('Fitting the page to my screen', async () => {
    await givenIAmReading(MOCK_CHAPTER);

    whenIOpenTheSettings();

    thenTheSettingsAreOpen(true);
    thenToolbarButtonIsExpanded('Settings', true);
    thenThePageFitIs('width');

    whenIChoose('Page size', 'HEIGHT');

    thenThePageFitIs('height');

    whenIChoose('Page size', 'ORIGINAL');

    thenThePageFitIs('original');

    await whenIOpen(chapter({ id: 'chap-11-uuid' }));

    thenThePageFitIs('original');
  });

  it('closes the settings with Escape and gives focus back to the Settings button', async () => {
    await givenIAmReading(MOCK_CHAPTER);
    givenTheSettingsAreOpen();
    thenTheSettingsAreOpen(true);

    whenIPress('Escape');

    thenTheSettingsAreOpen(false);
    thenFocusIsOnToolbarButton('Settings');
  });

  it('Changing the background colour', async () => {
    await givenIAmReading(MOCK_CHAPTER);
    givenTheSettingsAreOpen();
    thenTheBackgroundIs('black');

    whenIChoose('Background', 'GRAY');

    thenTheBackgroundIs('gray');

    whenIChoose('Background', 'WHITE');

    thenTheBackgroundIs('white');
  });

  it('Reading two pages side by side', async () => {
    givenMyScreenIsWide(true);
    await givenIAmReading(withPages(chapterOf('op-1', 'one-piece', 'MANGA'), 5));
    givenTheSettingsAreOpen();

    whenITurnOnDoublePage();

    thenTheStageShows(['Page 1']); // the cover stands alone

    await whenIClickNext();

    thenTheStageShows(['Page 3', 'Page 2']); // right to left: page 2 on the right, page 3 on the left

    await whenIClickNext();

    thenTheStageShows(['Page 5', 'Page 4']);
    thenIAmOnTheLastPage();

    await whenIClickPrevious();

    thenTheStageShows(['Page 3', 'Page 2']);
  });

  it('offers double page only on wide screens', async () => {
    givenMyScreenIsWide(false);
    await givenIAmReading(chapterOf('op-1', 'one-piece', 'MANGA'));

    whenIOpenTheSettings();

    thenTheSettingsDoNotOffer('Double page');
  });

  it('Letting a webtoon scroll by itself', async () => {
    givenAnimationFramesRunOnlyWhenTheTestSays();
    await givenIAmReading(chapterOf('sl-1', 'solo-leveling', 'MANHWA'));

    whenIPressTheToolbarButton('Auto-scroll');

    thenToolbarButtonIsPressed('Auto-scroll', true);

    whenAnimationFramesRunAt(0, 1000); // one second at medium speed

    thenTheLastScrollWasBy(60);

    whenIScrollTheWheel();

    thenToolbarButtonIsPressed('Auto-scroll', false);

    whenAnimationFramesRunAt(2000);

    thenTheFramesDidNotScroll();

    whenIOpenTheSettings();
    whenIChoose('Auto-scroll speed', 'FAST');
    whenIPressTheToolbarButton('Auto-scroll');
    whenAnimationFramesRunAt(3000, 3500);

    thenTheLastScrollWasBy(60);

    whenITouchTheScreen();

    thenToolbarButtonIsPressed('Auto-scroll', false);
  });

  it('Reading in zen mode', async () => {
    await givenIAmReading(MOCK_CHAPTER);
    givenTimeIsFrozen();

    whenIPressTheToolbarButton('Zen mode');

    thenTheSiteLayoutIsImmersive(true);
    thenTheControlsAreHidden(true);

    whenIMoveTheMouse();

    thenTheControlsAreHidden(false);

    await whenTimePasses(ZEN_CONTROLS_HIDE_MS - 100);

    thenTheControlsAreHidden(false);

    await whenTimePasses(100);

    thenTheControlsAreHidden(true);

    whenITapTheScreen();

    thenTheControlsAreHidden(false);

    whenIPress('Escape');

    thenTheSiteLayoutIsImmersive(false);
    thenTheControlsAreHidden(false);
    thenToolbarButtonIsPressed('Zen mode', false);
  });

  it('leaves zen mode when the reader is closed', async () => {
    await givenIAmReading(MOCK_CHAPTER);
    givenIPressedTheToolbarButton('Zen mode');
    thenTheSiteLayoutIsImmersive(true);

    whenICloseTheReader();

    thenTheSiteLayoutIsImmersive(false);
  });

  it('reports the current page to the team (US-06), with the reason chosen', async () => {
    await givenIAmSignedInWith(['PAGE_REPORT']);
    await givenIAmReading(MOCK_CHAPTER);
    await givenIAmInPagedMode();
    await givenITurnedForward(1);

    await whenIOpenTheReportDialog();

    thenTheReportTitleSays('Report page 2');

    whenIPressAnArrowKeyInsideTheDialog();

    thenIAmOnPage(2);

    await whenISendTheReport({ reason: 'MISSING_PAGE', answer: 'accepted' });

    thenTheRequestWentTo(`${API}/chapters/${MOCK_CHAPTER.id}/pages/2/reports`);
    thenTheRequestBodyWas({ reason: 'MISSING_PAGE' });
    thenTheReportDialogIsClosed();
    thenTheReportConfirmationSays('Page 2 was reported');
  });

  it('keeps the report dialog open with the reason when sending fails', async () => {
    await givenIAmSignedInWith(['PAGE_REPORT']);
    await givenIAmReading(MOCK_CHAPTER);
    await givenTheReportDialogIsOpen();

    await whenISendTheReport({ answer: 'Chapter 10 has no page 1' });

    thenTheRequestWentTo(`${API}/chapters/${MOCK_CHAPTER.id}/pages/1/reports`);
    thenTheDialogAlertSays('has no page 1');
  });

  it('hides "Report page" from readers without PAGE_REPORT', async () => {
    await whenIOpen(MOCK_CHAPTER);

    thenThereIsNoToolbarButton('Report page');
  });

  it('records the visit, then the finish, for the reading history (free readers with LIBRARY_USE)', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);

    await whenIOpen(MOCK_CHAPTER);
    whenTheReadingHistoryAnswers('down');

    thenTheRequestMethodWas('PUT');
    thenTheRequestBodyWas({ finished: false });

    await whenISwitchTo('Paged');
    await whenIClickNext();

    thenTheReadingHistoryWasNotUpdated();

    await whenIClickNext();
    whenTheReadingHistoryAnswers('ok');

    thenTheRequestBodyWas({ finished: true });

    await whenIGoBackAPageAndForwardAgain();

    thenTheReadingHistoryWasNotUpdated();
  });

  async function givenIAmReading(opened: Chapter, at: { page?: string } = {}): Promise<void> {
    await openChapter(opened, at.page);
  }

  async function givenIAmInPagedMode(): Promise<void> {
    await switchMode('Paged');
  }

  async function givenITurnedForward(pages: number): Promise<void> {
    for (let i = 0; i < pages; i++) await whenIClickNext();
  }

  /** From here on, time only moves when the test says so (debounce assertions). */
  function givenTimeIsFrozen(): void {
    vi.useFakeTimers();
  }

  function givenConsoleErrorsAreRecorded(): void {
    consoleErrors = vi.spyOn(console, 'error');
  }

  function givenINoteTheActiveImage(): void {
    previousActiveImage = activeImage();
  }

  function givenMyVisitWasRecorded(chapterId: string): void {
    http.expectOne(`${API}/reading/chapters/${chapterId}`).flush(ok(null));
  }

  function givenTheSettingsAreOpen(): void {
    whenIOpenTheSettings();
  }

  function givenMyScreenIsWide(wide: boolean): void {
    vi.stubGlobal('matchMedia', () => ({ matches: wide, addEventListener: () => undefined, removeEventListener: () => undefined }));
  }

  /**
   * The viewer drives the document's own window. Angular's scheduler also uses animation frames, so frames are
   * tracked by id and cancelling one never drops the others.
   */
  function givenAnimationFramesRunOnlyWhenTheTestSays(): void {
    const win = document.defaultView!;
    frames = new Map<number, FrameRequestCallback>();
    let lastId = 0;
    vi.spyOn(win, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      frames.set(++lastId, cb);
      return lastId;
    });
    vi.spyOn(win, 'cancelAnimationFrame').mockImplementation((id: number) => frames.delete(id));
    scrollBy = vi.spyOn(win, 'scrollBy').mockImplementation(() => undefined);
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 100_000 });
  }

  function givenIPressedTheToolbarButton(label: string): void {
    whenIPressTheToolbarButton(label);
  }

  async function givenTheReportDialogIsOpen(): Promise<void> {
    await whenIOpenTheReportDialog();
  }

  async function whenIOpen(opened: Chapter, at: { page?: string } = {}): Promise<void> {
    await openChapter(opened, at.page);
  }

  async function whenIOpenAMissingChapter(chapterId: string): Promise<void> {
    fixture.componentRef.setInput('chapterId', chapterId);
    await settle(fixture);
    http.expectOne((r) => r.url === `${API}/chapters/${chapterId}`).flush(fail('not found'), { status: 404, statusText: 'Not Found' });
    await settle(fixture);
  }

  async function whenISwitchTo(mode: 'Vertical' | 'Paged'): Promise<void> {
    await switchMode(mode);
  }

  async function whenIClickNext(): Promise<void> {
    fixture.nativeElement.querySelector('button.btn-next').click();
    await render();
  }

  async function whenIClickPrevious(): Promise<void> {
    fixture.nativeElement.querySelector('button.btn-prev').click();
    await render();
  }

  async function whenIReachTheLastPage(): Promise<void> {
    while (!stateService.isLastPage()) await whenIClickNext();
  }

  async function whenIGoBackAPageAndForwardAgain(): Promise<void> {
    await whenIClickPrevious();
    await whenIClickNext();
  }

  function whenPageScrollsIntoView(pageNumber: number): void {
    FakeIntersectionObserver.latest().show(pageNumber - 1);
    fixture.detectChanges();
  }

  async function whenTimePasses(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  /** Lets the sync debounce run out, then answers the progress save it sends. */
  async function whenTheProgressSyncRuns(sync: { after: number; answer: 'saved' | 'rejected' | 'network error' }): Promise<void> {
    await whenTimePasses(sync.after);
    lastRequest = http.expectOne(PROGRESS_URL);
    if (sync.answer === 'saved') {
      lastRequest.flush(ok({ workId: MOCK_CHAPTER.workId, lastReadChapterId: MOCK_CHAPTER.id, lastReadPageIndex: 2, status: 'READING', updatedAt: '' }));
    } else if (sync.answer === 'rejected') {
      lastRequest.flush(fail('CHAPTER_NOT_PUBLISHED'), { status: 400, statusText: 'Bad Request' });
    } else {
      lastRequest.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    }
    await whenTimePasses(0);
  }

  function whenILeaveAndOpenTheReaderAgain(): void {
    previousState = stateService;
    fixture.destroy();
    fixture = TestBed.createComponent(ReaderPage);
    stateService = fixture.debugElement.injector.get(ReaderState);
  }

  async function whenTheCommentsBlockRenders(): Promise<void> {
    const [comments] = await fixture.getDeferBlocks();
    await comments.render(DeferBlockState.Complete);
    await settle(fixture);
    http.expectOne(commentsUrl()).flush(ok([]));
    await settle(fixture);
  }

  async function whenIReadRightToLeft(): Promise<void> {
    toolbarButton('Right to left').click();
    await settle(fixture);
  }

  function whenIPress(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): void {
    lastKeyEvent = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(lastKeyEvent);
    fixture.detectChanges();
  }

  function whenIPressInATextField(key: string): void {
    const input = document.createElement('input');
    document.body.appendChild(input);
    whenIPress(key, {}, input);
    input.remove();
  }

  function whenIPressAnArrowKeyInsideTheDialog(): void {
    whenIPress('ArrowRight', {}, fixture.nativeElement.querySelector('[role="dialog"] input'));
  }

  /** A horizontal drag on the page: negative = finger moves left. Ends with the click a real tap produces. */
  function whenISwipe(dx: number): void {
    const stage: HTMLElement = fixture.nativeElement.querySelector('.page-stage');
    stage.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, clientY: 300, bubbles: true }));
    stage.dispatchEvent(new MouseEvent('pointerup', { clientX: 200 + dx, clientY: 305, bubbles: true }));
    fixture.nativeElement.querySelector(dx < 0 ? '.turn-zone-left' : '.turn-zone-right').click();
    fixture.detectChanges();
  }

  function whenITapTheRightSide(): void {
    fixture.nativeElement.querySelector('.turn-zone-right').click();
  }

  function whenITapTheLeftSide(): void {
    fixture.nativeElement.querySelector('.turn-zone-left').click();
  }

  function whenIDragThePageSliderTo(pageNumber: number): void {
    const bar = pageSlider();
    bar.value = `${pageNumber}`;
    bar.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Answers the list and read-state requests that opening the list sends. */
  async function whenIOpenTheChapterList(work: { chapters: number; finished: string[]; next: string }): Promise<void> {
    toolbarButton('Chapters').click();
    await settle(fixture);
    const chapters = Array.from({ length: work.chapters }, (_, i) => ({
      id: `c-${i + 1}`,
      workId: MOCK_CHAPTER.workId,
      chapterNumber: `${i + 1}`,
      title: `Chapter ${i + 1}`,
      status: 'PUBLISHED',
      pageCount: 3
    }));
    http.expectOne(`${API}/works/${MOCK_CHAPTER.workId}/chapters`).flush(ok(chapters));
    http.expectOne(`${API}/reading/works/${MOCK_CHAPTER.workId}`).flush(ok({ workId: MOCK_CHAPTER.workId, finishedChapterIds: work.finished, nextChapterId: work.next }));
    await settle(fixture);
  }

  async function whenIChooseFromTheChapterList(position: number): Promise<void> {
    toolbarButton('Chapters').click();
    fixture.detectChanges();
    chapterListLinks()[position - 1].click();
    fixture.detectChanges();
    await settle(fixture);
  }

  function whenIOpenTheSettings(): void {
    toolbarButton('Settings').click();
    fixture.detectChanges();
  }

  function whenITick(label: string): void {
    Array.from(settingsPanel().querySelectorAll<HTMLLabelElement>('label.checkbox'))
      .find((l) => l.textContent?.includes(label))!
      .querySelector('input')!
      .click();
    fixture.detectChanges();
  }

  function whenIChoose(label: string, value: string): void {
    const field = Array.from(settingsPanel().querySelectorAll<HTMLLabelElement>('label')).find((l) => l.textContent!.includes(label))!;
    const select = field.querySelector('select')!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function whenITurnOnDoublePage(): void {
    const toggle = settingsPanel().querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function whenIPressTheToolbarButton(label: string): void {
    toolbarButton(label).click();
    fixture.detectChanges();
  }

  function whenAnimationFramesRunAt(...timestamps: number[]): void {
    scrollsBeforeFrames = scrollBy.mock.calls.length;
    for (const at of timestamps) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((cb) => cb(at));
    }
  }

  function whenIScrollTheWheel(): void {
    document.dispatchEvent(new Event('wheel'));
    fixture.detectChanges();
  }

  function whenITouchTheScreen(): void {
    document.dispatchEvent(new Event('touchstart'));
    fixture.detectChanges();
  }

  function whenIMoveTheMouse(): void {
    document.dispatchEvent(new MouseEvent('mousemove'));
    fixture.detectChanges();
  }

  function whenITapTheScreen(): void {
    document.dispatchEvent(new MouseEvent('pointerdown'));
    fixture.detectChanges();
  }

  function whenICloseTheReader(): void {
    fixture.destroy();
  }

  async function whenIOpenTheReportDialog(): Promise<void> {
    toolbarButton('Report page').click();
    await settle(fixture);
    const [dialog] = await fixture.getDeferBlocks();
    await dialog.render(DeferBlockState.Complete);
    await settle(fixture);
  }

  /** `answer` is 'accepted' or the error message the server rejects the report with. */
  async function whenISendTheReport(report: { reason?: string; answer: string }): Promise<void> {
    if (report.reason) fixture.nativeElement.querySelector(`input[value="${report.reason}"]`).click();
    fixture.nativeElement.querySelector('[role="dialog"] form').dispatchEvent(new Event('submit', { cancelable: true }));
    lastRequest = http.expectOne((r) => r.url.endsWith('/reports'));
    if (report.answer === 'accepted') {
      lastRequest.flush(ok({ id: 'r-1' }));
    } else {
      lastRequest.flush(fail(report.answer), { status: 400, statusText: 'Bad Request' });
    }
    await settle(fixture);
  }

  /** The history write is best effort: a failed one ('down') must not stop the next one. */
  function whenTheReadingHistoryAnswers(answer: 'ok' | 'down'): void {
    lastRequest = http.expectOne(HISTORY_URL);
    lastRequest.flush(answer === 'ok' ? ok(null) : fail('down'));
  }

  async function whenTheTopCommentsArrive(query: { limit: number }, comments: ChapterComment[]): Promise<void> {
    http.expectOne(`${commentsUrl()}/top?limit=${query.limit}`).flush(ok(comments));
    await settle(fixture);
  }

  function thenTheOpenChapterIs(chapterId: string): void {
    expect(stateService.currentChapter()?.id).toBe(chapterId);
  }

  function thenNoChapterIsOpen(): void {
    expect(stateService.currentChapter()).toBeNull();
  }

  function thenTheReaderStateIsNew(): void {
    expect(stateService).not.toBe(previousState);
  }

  function thenTheVerticalFlowHasPages(count: number): void {
    expect(fixture.nativeElement.querySelectorAll('.vertical-flow .page-wrapper')).toHaveLength(count);
  }

  function thenTheFirstVerticalPageIsNumbered(dataPage: string): void {
    expect(fixture.nativeElement.querySelector('.vertical-flow .page-wrapper').getAttribute('data-page')).toBe(dataPage);
  }

  function thenVerticalImageShows(position: number, url: string): void {
    expect(verticalImages()[position - 1].src).toContain(url);
  }

  function thenTheVerticalImagesAre(urls: string[]): void {
    expect(verticalImages().map((img) => img.getAttribute('src'))).toEqual(urls);
  }

  function thenVerticalImageIsPrioritised(position: number): void {
    expect(verticalImages()[position - 1].getAttribute('fetchpriority')).toBe('high');
  }

  function thenVerticalImageIsNotPrioritised(position: number): void {
    expect(verticalImages()[position - 1].getAttribute('fetchpriority')).not.toBe('high');
  }

  function thenVerticalImageIsLazy(position: number): void {
    expect(verticalImages()[position - 1].getAttribute('loading')).toBe('lazy');
  }

  /** No dimensions from the API: 2:3 defaults still reserve the space. */
  function thenTheVerticalImageSizesAre(sizes: [string, string][]): void {
    expect(verticalImages().map((img) => [img.getAttribute('width'), img.getAttribute('height')])).toEqual(sizes);
  }

  function thenTheChapterTitleSays(title: string): void {
    expect(fixture.nativeElement.querySelector('h1.chapter-title').textContent).toContain(title);
  }

  function thenTheChapterWasNotFetchedAgain(): void {
    http.expectNone(`${API}/chapters/${MOCK_CHAPTER.id}`);
  }

  function thenTheActivePageShows(file: string): void {
    expect(activeImage().src).toContain(file);
  }

  /** A fresh image per page carries that page's own intrinsic size. */
  function thenTheActiveImageIsANewElement(): void {
    expect(activeImage()).not.toBe(previousActiveImage);
  }

  function thenTheActiveImageSizeIs(width: string, height: string): void {
    expect([activeImage().getAttribute('width'), activeImage().getAttribute('height')]).toEqual([width, height]);
  }

  function thenNoConsoleErrorMentions(code: string): void {
    expect(consoleErrors.mock.calls.flat().join(' ')).not.toContain(code);
  }

  function thenIAmOnPage(pageNumber: number): void {
    expect(stateService.currentPageIndex()).toBe(pageNumber - 1);
  }

  function thenIAmOnTheLastPage(): void {
    expect(stateService.isLastPage()).toBe(true);
  }

  function thenThePageIndicatorSays(text: string): void {
    expect(fixture.nativeElement.querySelector('.page-indicator').textContent).toContain(text);
  }

  function thenThePageIndicatorIsHiddenFromScreenReaders(): void {
    expect(fixture.nativeElement.querySelector('.page-indicator').getAttribute('aria-hidden')).toBe('true');
  }

  function thenTheObserverWatchesPages(count: number): void {
    expect(FakeIntersectionObserver.latest().observed).toHaveLength(count);
  }

  function thenTheAlertSays(text: string): void {
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(text);
  }

  function thenNoPageImageIsShown(): void {
    expect(fixture.nativeElement.querySelectorAll('img.page-image')).toHaveLength(0);
  }

  function thenTheSyncHintSays(text: string): void {
    expect(fixture.nativeElement.querySelector('.sync-hint').textContent).toContain(text);
  }

  function thenNoBookmarkWasSynced(): void {
    http.expectNone((r) => r.url.includes('/bookmarks/'));
  }

  function thenNoProgressWasSynced(): void {
    http.expectNone(PROGRESS_URL);
  }

  function thenTheRequestMethodWas(method: string): void {
    expect(lastRequest.request.method).toBe(method);
  }

  function thenTheRequestWentTo(url: string): void {
    expect(lastRequest.request.url).toBe(url);
  }

  function thenTheRequestBodyWas(body: unknown): void {
    expect(lastRequest.request.body).toEqual(body);
  }

  function thenTheCommentsPlaceholderIsShown(): void {
    expect(fixture.nativeElement.querySelector('.comments-placeholder')).not.toBeNull();
  }

  function thenTheCommentsAreNotRendered(): void {
    expect(fixture.nativeElement.querySelector('app-chapter-comments')).toBeNull();
  }

  function thenTheCommentsAreRendered(): void {
    expect(fixture.nativeElement.querySelector('app-chapter-comments')).not.toBeNull();
  }

  function thenTheCommentsWereNotFetched(): void {
    http.expectNone(commentsUrl());
  }

  function thenTheNavButtonsAre(labels: string[]): void {
    expect(Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.paged-nav button')).map((b) => b.textContent!.trim())).toEqual(labels);
  }

  function thenToolbarButtonIsPressed(label: string, pressed: boolean): void {
    expect(toolbarButton(label).getAttribute('aria-pressed')).toBe(String(pressed));
  }

  function thenToolbarButtonIsExpanded(label: string, expanded: boolean): void {
    expect(toolbarButton(label).getAttribute('aria-expanded')).toBe(String(expanded));
  }

  function thenThereIsNoToolbarButton(label: string): void {
    expect(toolbarButton(label)).toBeUndefined();
  }

  function thenFocusIsOnToolbarButton(label: string): void {
    expect(document.activeElement).toBe(toolbarButton(label));
  }

  function thenThePageSliderDirectionIs(dir: string): void {
    expect(pageSlider().getAttribute('dir')).toBe(dir);
  }

  function thenThePageSliderSays(text: string): void {
    expect(pageSlider().getAttribute('aria-valuetext')).toBe(text);
  }

  function thenTheProgressPercentIs(percent: string): void {
    expect(fixture.nativeElement.querySelector('.progress-percent').textContent.trim()).toBe(percent);
  }

  function thenTheViewModeIs(mode: 'VERTICAL' | 'PAGED'): void {
    expect(stateService.viewMode()).toBe(mode);
  }

  function thenTheDirectionIs(direction: 'LTR' | 'RTL'): void {
    expect(stateService.direction()).toBe(direction);
  }

  /** Arrow keys are the reader's own shortcuts, so it stops the browser from also scrolling. */
  function thenTheKeyWasHandledByTheReader(handled: boolean): void {
    expect(lastKeyEvent.defaultPrevented).toBe(handled);
  }

  function thenThePreloadedImagesAre(urls: string[]): void {
    expect(Array.from<HTMLImageElement>(fixture.nativeElement.querySelectorAll('.preload img')).map((img) => img.getAttribute('src'))).toEqual(urls);
  }

  function thenThereIsNoChapterEnd(): void {
    expect(fixture.nativeElement.querySelector('.chapter-end')).toBeNull();
  }

  function thenTheChapterEndLinksAre(links: [string, string][]): void {
    const shown = Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('.chapter-end a')).map((a) => [a.textContent!.trim(), a.getAttribute('href')]);
    expect(shown).toEqual(links);
  }

  function thenTheChapterEndSays(text: string): void {
    expect(fixture.nativeElement.querySelector('.chapter-end').textContent).toContain(text);
  }

  function thenTheChapterListIsHidden(): void {
    expect((fixture.nativeElement.querySelector('#reader-chapters') as HTMLElement).hidden).toBe(true);
  }

  function thenTheChapterListWasNotFetched(): void {
    http.expectNone(`${API}/works/${MOCK_CHAPTER.workId}/chapters`);
  }

  function thenTheChapterListHasEntries(count: number): void {
    expect(chapterListLinks()).toHaveLength(count);
  }

  function thenTheChaptersMarkedReadLinkTo(hrefs: string[]): void {
    expect(chapterListLinks().filter((a) => a.classList.contains('read')).map((a) => a.getAttribute('href'))).toEqual(hrefs);
  }

  function thenChapterListEntryIsCurrent(position: number): void {
    expect(chapterListLinks()[position - 1].getAttribute('aria-current')).toBe('page');
  }

  function thenChapterListEntryLinksTo(position: number, href: string): void {
    expect(chapterListLinks()[position - 1].getAttribute('href')).toBe(href);
  }

  function thenIAmOn(url: string): void {
    expect(TestBed.inject(Router).url).toBe(url);
  }

  function thenDataSaverIsRemembered(on: boolean): void {
    expect(TestBed.inject(ReaderPreferencesStore).dataSaver()).toBe(on);
  }

  function thenTheAnnouncementIs(text: string): void {
    expect(fixture.nativeElement.querySelector('.page-announcement[aria-live="polite"]').textContent.trim()).toBe(text);
  }

  function thenTheShownPageIsDescribedAs(alt: string): void {
    expect(fixture.nativeElement.querySelector('.page-stage img.page-image').alt).toBe(alt);
  }

  function thenTheTopCommentsWereNotFetched(): void {
    http.expectNone((r) => r.url.endsWith('/top'));
  }

  function thenTheTopCommentsAre(contents: string[]): void {
    expect(topComments().map((li) => li.querySelector('p')!.textContent)).toEqual(contents);
  }

  function thenTopCommentAuthorLinksTo(position: number, href: string): void {
    expect(topComments()[position - 1].querySelector('a')!.getAttribute('href')).toBe(href);
  }

  function thenThereAreTopComments(count: number): void {
    expect(topComments()).toHaveLength(count);
  }

  function thenTheSettingsAreOpen(open: boolean): void {
    expect(settingsPanel().hidden).toBe(!open);
  }

  function thenTheSettingsDoNotOffer(option: string): void {
    expect(settingsPanel().textContent).not.toContain(option);
  }

  function thenThePageFitIs(fit: 'width' | 'height' | 'original'): void {
    expect(fixture.nativeElement.querySelector('app-vertical-flow, app-paged-flow').classList).toContain(`fit-${fit}`);
  }

  function thenTheBackgroundIs(colour: 'black' | 'gray' | 'white'): void {
    expect(fixture.nativeElement.querySelector('.viewer-container').classList).toContain(`bg-${colour}`);
  }

  function thenTheStageShows(alts: string[]): void {
    expect(Array.from<HTMLImageElement>(fixture.nativeElement.querySelectorAll('.page-stage img.page-image')).map((img) => img.alt)).toEqual(alts);
  }

  function thenTheLastScrollWasBy(pixels: number): void {
    expect(scrollBy).toHaveBeenLastCalledWith(0, pixels);
  }

  function thenTheFramesDidNotScroll(): void {
    expect(scrollBy.mock.calls.length).toBe(scrollsBeforeFrames);
  }

  /** Zen mode makes the shell hide the site header and footer. */
  function thenTheSiteLayoutIsImmersive(immersive: boolean): void {
    expect(TestBed.inject(LayoutStore).immersive()).toBe(immersive);
  }

  function thenTheControlsAreHidden(hidden: boolean): void {
    expect(fixture.nativeElement.querySelector('.reader-controls').classList.contains('controls-hidden')).toBe(hidden);
  }

  function thenTheReportTitleSays(text: string): void {
    expect(fixture.nativeElement.querySelector('#report-title').textContent).toContain(text);
  }

  function thenTheReportDialogIsClosed(): void {
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  }

  function thenTheReportConfirmationSays(text: string): void {
    expect(fixture.nativeElement.querySelector('.report-confirmation').textContent).toContain(text);
  }

  function thenTheDialogAlertSays(text: string): void {
    expect(fixture.nativeElement.querySelector('[role="dialog"] [role="alert"]').textContent).toContain(text);
  }

  function thenTheReadingHistoryWasNotUpdated(): void {
    http.expectNone(HISTORY_URL);
  }

  /** Renders the viewer for `read/:chapterId[?page=N]`, answering the chapter (a GET) and comments requests. */
  async function openChapter(opened: Chapter, page?: string): Promise<void> {
    fixture.componentRef.setInput('chapterId', opened.id);
    if (page !== undefined) {
      fixture.componentRef.setInput('page', page);
    }
    await settle(fixture);
    http.expectOne((r) => r.method === 'GET' && r.url === `${API}/chapters/${opened.id}`).flush(ok(opened));
    await settle(fixture);
    http.match(`${API}/comments/chapter/${opened.id}`).forEach((r) => r.flush(ok([])));
    await settle(fixture);
  }

  async function switchMode(label: 'Vertical' | 'Paged'): Promise<void> {
    toolbarButton(label).click();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  /** `settle()` waits on a real timeout, so under frozen time the clock is stepped instead. */
  async function render(): Promise<void> {
    if (vi.isFakeTimers()) {
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
    } else {
      await settle(fixture);
    }
  }

  function commentsUrl(): string {
    return `${API}/comments/chapter/${MOCK_CHAPTER.id}`;
  }

  function toolbarButton(label: string): HTMLButtonElement {
    return Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.viewer-actions button')).find((b) => b.textContent?.trim() === label)!;
  }

  function activeImage(): HTMLImageElement {
    return fixture.nativeElement.querySelector('img.active-page');
  }

  function verticalImages(): HTMLImageElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.vertical-flow img.page-image'));
  }

  function pageSlider(): HTMLInputElement {
    return fixture.nativeElement.querySelector('#page-jump');
  }

  function chapterListLinks(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.reader-chapter-list a'));
  }

  function settingsPanel(): HTMLElement {
    return fixture.nativeElement.querySelector('#reader-settings');
  }

  function topComments(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.top-comments li'));
  }
});
