import { ComponentFixture, DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { PROGRESS_SYNC_DEBOUNCE_MS, ReaderPage, ZEN_CONTROLS_HIDE_MS } from '@app/features/reader/reader-page';
import { ReaderState } from '@app/features/reader/services/reader-state';
import { ReaderPreferencesStore } from '@app/features/reader/services/reader-preferences-store';
import { AuthStore } from '@app/core/auth/auth-store';
import { LayoutStore } from '@app/core/layout/layout-store';
import { Chapter } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { ANY_URL, API, fail, ok, provideHttpTesting, settle } from '../../test-utils';

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
const PREMIUM = mockUser({ permissions: ['COMMENT_WRITE', 'BOOKMARK_READ', 'BOOKMARK_WRITE'] });

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
  let store: AuthStore;

  beforeEach(async () => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    await TestBed.configureTestingModule({
      imports: [ReaderPage],
      providers: [provideRouter(ANY_URL), ...provideHttpTesting()],
      deferBlockBehavior: DeferBlockBehavior.Manual
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(ReaderPage);
    stateService = fixture.debugElement.injector.get(ReaderState);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // Reaching the last page loads the chapter's top comments (own test below).
    // Opening another chapter cancels the previous chapter's request.
    http.match((r) => r.url.endsWith('/top')).filter((r) => !r.cancelled).forEach((r) => r.flush(ok([])));
    http.verify();
  });

  const chapterUrl = (r: { url: string }) => r.url === `${API}/chapters/${MOCK_CHAPTER.id}`;
  const commentsUrl = `${API}/comments/chapter/${MOCK_CHAPTER.id}`;

  /** Renders the viewer for `read/:chapterId[?page=N]`, answering the chapter + comments requests. */
  async function loadChapter(page?: string, chapter: Chapter = MOCK_CHAPTER): Promise<void> {
    fixture.componentRef.setInput('chapterId', chapter.id);
    if (page !== undefined) {
      fixture.componentRef.setInput('page', page);
    }
    await settle(fixture);

    const req = http.expectOne((r) => r.url === `${API}/chapters/${chapter.id}`);
    expect(req.request.method).toBe('GET');
    req.flush(ok(chapter));
    await settle(fixture);

    http.match(`${API}/comments/chapter/${chapter.id}`).forEach((r) => r.flush(ok([])));
    await settle(fixture);
  }

  /** A chapter of a given series and format, as the reader endpoint returns it. */
  function chapterOf(id: string, workId: string, type: 'MANGA' | 'MANHWA' | 'COMIC'): Chapter {
    return { ...MOCK_CHAPTER, id, workId, work: { id: workId, title: workId, type } };
  }

  function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  /** A horizontal drag on the page: negative = finger moves left. Ends with the click a real tap produces. */
  function swipe(dx: number): void {
    const stage: HTMLElement = fixture.nativeElement.querySelector('.page-stage');
    stage.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, clientY: 300, bubbles: true }));
    stage.dispatchEvent(new MouseEvent('pointerup', { clientX: 200 + dx, clientY: 305, bubbles: true }));
    fixture.nativeElement.querySelector(dx < 0 ? '.turn-zone-left' : '.turn-zone-right').click();
    fixture.detectChanges();
  }

  const navButtons = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.paged-nav button') as NodeListOf<HTMLButtonElement>).map((b) => b.textContent!.trim());

  /** From here on, time only moves when the test says so (debounce assertions). */
  function freezeTime(): void {
    vi.useFakeTimers();
  }

  async function elapse(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  function click(selector: string): void {
    fixture.debugElement.query(By.css(selector)).nativeElement.click();
    fixture.detectChanges();
  }

  function toolbarButton(label: string): HTMLButtonElement {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.viewer-actions button')) as HTMLButtonElement[];
    return buttons.find((b) => b.textContent?.trim() === label)!;
  }

  async function switchMode(label: 'Vertical' | 'Paged'): Promise<void> {
    toolbarButton(label).click();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  const syncHint = (): string => fixture.nativeElement.querySelector('.sync-hint').textContent;

  it('loads the chapter from the API and renders all pages in vertical mode', async () => {
    await loadChapter();

    expect(stateService.currentChapter()?.id).toBe(MOCK_CHAPTER.id);
    const wrappers = fixture.debugElement.queryAll(By.css('.vertical-flow .page-wrapper'));
    expect(wrappers.length).toBe(3);
    expect(wrappers[0].nativeElement.getAttribute('data-page')).toBe('1');

    const images = fixture.debugElement.queryAll(By.css('.vertical-flow .page-image'));
    expect(images[0].nativeElement.src).toContain('https://cdn.readora.com/p1.webp');
    expect(fixture.nativeElement.querySelector('h1.chapter-title').textContent).toContain('Chapter 10');
  });

  it('renders single page and navigation in paged mode, without re-fetching the chapter', async () => {
    await loadChapter();
    await switchMode('Paged');
    http.expectNone(chapterUrl);

    expect(fixture.debugElement.query(By.css('img.active-page')).nativeElement.src).toContain('p1.webp');
    click('button.btn-next');
    expect(fixture.debugElement.query(By.css('img.active-page')).nativeElement.src).toContain('p2.webp');
  });

  it('paged mode moves between pages of different sizes without NgOptimizedImage errors (NG02953)', async () => {
    const errors = vi.spyOn(console, 'error');
    await loadChapter(undefined, {
      ...MOCK_CHAPTER,
      pages: [
        { pageNumber: 1, storageKey: 'p1.webp', cdnUrl: 'https://cdn.readora.com/p1.webp', width: 800, height: 1200 },
        { pageNumber: 2, storageKey: 'p2.webp', cdnUrl: 'https://cdn.readora.com/p2.webp', width: 720, height: 5000 },
        { pageNumber: 3, storageKey: 'p3.webp', cdnUrl: 'https://cdn.readora.com/p3.webp', width: 800, height: 1150 }
      ]
    });
    await switchMode('Paged');
    const first = fixture.debugElement.query(By.css('img.active-page')).nativeElement as HTMLImageElement;

    click('button.btn-next');
    const second = fixture.debugElement.query(By.css('img.active-page')).nativeElement as HTMLImageElement;

    // A fresh image per page carries that page's own intrinsic size.
    expect(second).not.toBe(first);
    expect([second.getAttribute('width'), second.getAttribute('height')]).toEqual(['720', '5000']);
    expect(errors.mock.calls.flat().join(' ')).not.toContain('NG02953');
    errors.mockRestore();
  });

  it('keeps the current page when switching view mode', async () => {
    await loadChapter();
    await switchMode('Paged');
    click('button.btn-next');
    click('button.btn-next');
    expect(stateService.currentPageIndex()).toBe(2);

    await switchMode('Vertical');
    await switchMode('Paged');

    http.expectNone(chapterUrl);
    expect(stateService.currentPageIndex()).toBe(2);
    expect(fixture.nativeElement.querySelector('.page-indicator').textContent).toContain('Page 3 / 3');
  });

  it('tracks the visible page in vertical mode', async () => {
    await loadChapter();
    const observer = FakeIntersectionObserver.latest();
    expect(observer.observed.length).toBe(3);

    observer.show(1);
    fixture.detectChanges();

    expect(stateService.currentPageIndex()).toBe(1);
    expect(fixture.nativeElement.querySelector('.page-indicator').textContent).toContain('Page 2 / 3');
  });

  it('opens on the page given by ?page=N', async () => {
    await loadChapter('3');
    expect(stateService.currentPageIndex()).toBe(2);
  });

  it('ignores an invalid ?page value', async () => {
    await loadChapter('abc');
    expect(stateService.currentPageIndex()).toBe(0);
  });

  it('shows an error state (no crash) when the chapter cannot be loaded', async () => {
    fixture.componentRef.setInput('chapterId', 'unknown');
    await settle(fixture);
    http.expectOne((r) => r.url === `${API}/chapters/unknown`).flush(fail('not found'), { status: 404, statusText: 'Not Found' });
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Chapter unavailable');
    expect(fixture.nativeElement.querySelectorAll('img.page-image').length).toBe(0);
  });

  it('shows the Premium upsell and never syncs progress for a free reader', async () => {
    await signIn(store, http);
    await loadChapter();
    freezeTime();

    expect(syncHint()).toContain('Go Premium');
    FakeIntersectionObserver.latest().show(1);
    await elapse(PROGRESS_SYNC_DEBOUNCE_MS + 50);
    http.expectNone((r) => r.url.includes('/bookmarks/'));
  });

  it('does not overwrite the saved bookmark just by opening a chapter', async () => {
    await signIn(store, http, PREMIUM);
    await loadChapter('2');
    freezeTime();

    await elapse(PROGRESS_SYNC_DEBOUNCE_MS * 2);
    http.expectNone(PROGRESS_URL);
    expect(syncHint()).toContain('Progress is saved automatically');
  });

  it('debounces and syncs reading progress (1-based page) for a PREMIUM reader', async () => {
    await signIn(store, http, PREMIUM);
    await loadChapter();
    await switchMode('Paged');
    freezeTime();

    click('button.btn-next');
    await elapse(PROGRESS_SYNC_DEBOUNCE_MS - 100);
    http.expectNone(PROGRESS_URL);
    await elapse(150);

    const progress = http.expectOne(PROGRESS_URL);
    expect(progress.request.method).toBe('PUT');
    expect(progress.request.body).toEqual({ chapterId: MOCK_CHAPTER.id, pageIndex: 2 });
    progress.flush(ok({ workId: MOCK_CHAPTER.workId, lastReadChapterId: MOCK_CHAPTER.id, lastReadPageIndex: 2, status: 'READING', updatedAt: '' }));
    await elapse(0);
    expect(syncHint()).toContain('Progress saved');
  });

  it('keeps syncing after a failed save (400 / network)', async () => {
    await signIn(store, http, PREMIUM);
    await loadChapter();
    await switchMode('Paged');
    freezeTime();

    click('button.btn-next');
    await elapse(PROGRESS_SYNC_DEBOUNCE_MS);
    http.expectOne(PROGRESS_URL).flush(fail('CHAPTER_NOT_PUBLISHED'), { status: 400, statusText: 'Bad Request' });
    await elapse(0);
    expect(syncHint()).toContain('Could not save progress');

    click('button.btn-next');
    await elapse(PROGRESS_SYNC_DEBOUNCE_MS);
    http.expectOne(PROGRESS_URL).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await elapse(0);
    expect(syncHint()).toContain('Could not save progress');

    click('button.btn-prev');
    await elapse(PROGRESS_SYNC_DEBOUNCE_MS);
    const retry = http.expectOne(PROGRESS_URL);
    expect(retry.request.body).toEqual({ chapterId: MOCK_CHAPTER.id, pageIndex: 2 });
    retry.flush(ok({ workId: MOCK_CHAPTER.workId, lastReadChapterId: MOCK_CHAPTER.id, lastReadPageIndex: 2, status: 'READING', updatedAt: '' }));
    await elapse(0);
    expect(syncHint()).toContain('Progress saved');
  });

  it('renders pages with NgOptimizedImage: reserved size, first page prioritised, others lazy', async () => {
    await loadChapter();
    const images = Array.from(fixture.nativeElement.querySelectorAll('.vertical-flow img.page-image')) as HTMLImageElement[];

    expect(images[0].getAttribute('fetchpriority')).toBe('high');
    expect(images[1].getAttribute('loading')).toBe('lazy');
    expect(images[1].getAttribute('fetchpriority')).not.toBe('high');
    // No dimensions from the API: 2:3 defaults still reserve the space.
    expect(images.map((img) => [img.getAttribute('width'), img.getAttribute('height')])).toEqual([
      ['800', '1200'],
      ['800', '1200'],
      ['800', '1200']
    ]);
  });

  it('gives every reader visit its own state (nothing carried over from the previous visit)', async () => {
    await loadChapter();
    expect(stateService.currentChapter()?.id).toBe(MOCK_CHAPTER.id);
    fixture.destroy();

    const next = TestBed.createComponent(ReaderPage);
    const nextState = next.debugElement.injector.get(ReaderState);
    expect(nextState).not.toBe(stateService);
    expect(nextState.currentChapter()).toBeNull();
    next.destroy();
  });

  it('defers the comments section: placeholder first, thread loaded only once the block renders', async () => {
    await loadChapter();
    expect(fixture.nativeElement.querySelector('.comments-placeholder')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-chapter-comments')).toBeNull();
    http.expectNone(commentsUrl);

    const [comments] = await fixture.getDeferBlocks();
    await comments.render(DeferBlockState.Complete);
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('app-chapter-comments')).not.toBeNull();
    http.expectOne(commentsUrl).flush(ok([]));
    await settle(fixture);
  });

  it('Reading manga right to left', async () => {
    await loadChapter(undefined, chapterOf('sl-1', 'solo-leveling', 'MANHWA'));
    await switchMode('Paged');
    expect(navButtons()).toEqual(['← Prev', 'Next →']);

    toolbarButton('Right to left').click();
    await settle(fixture);

    expect(toolbarButton('Right to left').getAttribute('aria-pressed')).toBe('true');
    expect(navButtons()).toEqual(['← Next', 'Prev →']);
    press('ArrowLeft');
    expect(stateService.currentPageIndex()).toBe(1);
    press('ArrowRight');
    expect(stateService.currentPageIndex()).toBe(0);
    swipe(+120);
    expect(stateService.currentPageIndex()).toBe(1);
    expect(fixture.nativeElement.querySelector('#page-jump').getAttribute('dir')).toBe('rtl');
  });

  it('The reader opens in the right mode for the format', async () => {
    await loadChapter(undefined, chapterOf('sl-1', 'solo-leveling', 'MANHWA'));
    expect(stateService.viewMode()).toBe('VERTICAL');

    await loadChapter(undefined, chapterOf('op-1', 'one-piece', 'MANGA'));
    expect(stateService.viewMode()).toBe('PAGED');
    expect(stateService.direction()).toBe('RTL');
    expect(navButtons()).toEqual(['← Next', 'Prev →']);
  });

  it('The reader remembers my mode for each series', async () => {
    await loadChapter(undefined, chapterOf('op-1', 'one-piece', 'MANGA'));
    await switchMode('Vertical');

    await loadChapter(undefined, chapterOf('op-2', 'one-piece', 'MANGA'));
    expect(stateService.viewMode()).toBe('VERTICAL');

    await loadChapter(undefined, chapterOf('sl-1', 'solo-leveling', 'MANHWA'));
    expect(stateService.viewMode()).toBe('VERTICAL');
    await switchMode('Paged');
    await loadChapter(undefined, chapterOf('op-3', 'one-piece', 'MANGA'));
    expect(stateService.viewMode()).toBe('VERTICAL');
    await loadChapter(undefined, chapterOf('sl-2', 'solo-leveling', 'MANHWA'));
    expect(stateService.viewMode()).toBe('PAGED');
  });

  it('Turning pages with the keyboard or a click', async () => {
    const long: Chapter = { ...MOCK_CHAPTER, pages: [1, 2, 3, 4, 5, 6].map((n) => ({ pageNumber: n, storageKey: `p${n}`, cdnUrl: `https://cdn.readora.com/p${n}.webp` })) };
    await loadChapter(undefined, long);
    await switchMode('Paged');

    expect(press('ArrowRight').defaultPrevented).toBe(true);
    press(' ');
    press('PageDown');
    expect(stateService.currentPageIndex()).toBe(3);
    press('PageUp');
    press(' ', { shiftKey: true });
    expect(stateService.currentPageIndex()).toBe(1);

    fixture.nativeElement.querySelector('.turn-zone-right').click();
    expect(stateService.currentPageIndex()).toBe(2);
    fixture.nativeElement.querySelector('.turn-zone-left').click();
    expect(stateService.currentPageIndex()).toBe(1);
    swipe(-120);
    expect(stateService.currentPageIndex()).toBe(2);
    swipe(-20); // too short: a tap on the left zone, which goes back
    expect(stateService.currentPageIndex()).toBe(1);
  });

  it('keys are ignored while typing, with modifiers, and in vertical mode', async () => {
    await loadChapter();
    press('ArrowRight');
    expect(stateService.currentPageIndex()).toBe(0);

    await switchMode('Paged');
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(press('ArrowRight', {}, input).defaultPrevented).toBe(false);
    press('ArrowRight', { ctrlKey: true });
    expect(stateService.currentPageIndex()).toBe(0);
    input.remove();
  });

  it('Pages turn instantly', async () => {
    const long: Chapter = { ...MOCK_CHAPTER, pages: [1, 2, 3, 4, 5, 6].map((n) => ({ pageNumber: n, storageKey: `p${n}`, cdnUrl: `https://cdn.readora.com/p${n}.webp` })) };
    await loadChapter('3', long);
    await switchMode('Paged');

    const preloaded = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.preload img') as NodeListOf<HTMLImageElement>).map((img) => img.getAttribute('src')!);
    expect(preloaded()).toEqual(['https://cdn.readora.com/p4.webp', 'https://cdn.readora.com/p5.webp']);

    click('button.btn-next');
    expect(fixture.nativeElement.querySelector('img.active-page').getAttribute('src')).toContain('p4.webp');
    expect(preloaded()).toEqual(['https://cdn.readora.com/p5.webp', 'https://cdn.readora.com/p6.webp']);
  });

  it('Seeing where I am and jumping to a page', async () => {
    const twenty: Chapter = {
      ...MOCK_CHAPTER,
      pages: Array.from({ length: 20 }, (_, i) => ({ pageNumber: i + 1, storageKey: `p${i + 1}`, cdnUrl: `https://cdn.readora.com/p${i + 1}.webp` }))
    };
    await loadChapter('8', twenty);

    const bar: HTMLInputElement = fixture.nativeElement.querySelector('#page-jump');
    expect(fixture.nativeElement.querySelector('.progress-percent').textContent.trim()).toBe('40%');
    expect(bar.getAttribute('aria-valuetext')).toBe('Page 8 of 20');

    bar.value = '20';
    bar.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(stateService.currentPageIndex()).toBe(19);
    expect(fixture.nativeElement.querySelector('.progress-percent').textContent.trim()).toBe('100%');
  });

  it('shows previous / next chapter and the chapter list at the end of a chapter', async () => {
    const middle: Chapter = { ...chapterOf('sl-5', 'solo-leveling', 'MANHWA'), chapterNumber: '5', previousChapterId: 'sl-4', nextChapterId: 'sl-6' };
    await loadChapter(undefined, middle);
    await switchMode('Paged');
    expect(fixture.nativeElement.querySelector('.chapter-end')).toBeNull();

    click('button.btn-next');
    click('button.btn-next');
    const links = Array.from(fixture.nativeElement.querySelectorAll('.chapter-end a') as NodeListOf<HTMLAnchorElement>).map((a) => [
      a.textContent!.trim(),
      a.getAttribute('href')
    ]);
    expect(links).toEqual([
      ['Previous chapter', '/read/sl-4'],
      ['Chapter list', '/works/solo-leveling#chapters'],
      ['Next chapter', '/read/sl-6']
    ]);

    const latest: Chapter = { ...middle, id: 'sl-6', chapterNumber: '6', previousChapterId: 'sl-5', nextChapterId: null };
    await loadChapter(undefined, latest);
    await switchMode('Vertical');
    expect(fixture.nativeElement.querySelector('.chapter-end').textContent).toContain("You're up to date");
  });

  it('Opening the chapter list inside the reader', async () => {
    await signIn(store, http, mockUser({ permissions: ['LIBRARY_USE'] }));
    const five: Chapter = { ...MOCK_CHAPTER, id: 'c-5', chapterNumber: '5' };
    await loadChapter(undefined, five);
    http.match(`${API}/reading/chapters/c-5`).forEach((r) => r.flush(ok(null)));
    expect((fixture.nativeElement.querySelector('#reader-chapters') as HTMLElement).hidden).toBe(true);
    http.expectNone(`${API}/works/${MOCK_CHAPTER.workId}/chapters`);

    const toggle = toolbarButton('Chapters');
    toggle.click();
    await settle(fixture);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    http.expectOne(`${API}/works/${MOCK_CHAPTER.workId}/chapters`).flush(ok([1, 2, 3, 4, 5].map((n) => ({ id: `c-${n}`, workId: MOCK_CHAPTER.workId, chapterNumber: `${n}`, title: `Chapter ${n}`, status: 'PUBLISHED', pageCount: 3 }))));
    http.expectOne(`${API}/reading/works/${MOCK_CHAPTER.workId}`).flush(ok({ workId: MOCK_CHAPTER.workId, finishedChapterIds: ['c-1', 'c-2', 'c-3', 'c-4'], nextChapterId: 'c-5' }));
    await settle(fixture);

    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('.reader-chapter-list a'));
    expect(links).toHaveLength(5);
    expect(links.filter((a) => a.classList.contains('read')).map((a) => a.getAttribute('href'))).toEqual(['/read/c-1', '/read/c-2', '/read/c-3', '/read/c-4']);
    expect(links[4].getAttribute('aria-current')).toBe('page');
    expect(links[1].getAttribute('href')).toBe('/read/c-2');

    // Escape closes the list and gives focus back to its button.
    press('Escape');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);

    // Choosing chapter 2 closes the list and navigates inside the reader.
    toggle.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelectorAll('.reader-chapter-list a')[1] as HTMLAnchorElement).click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/read/c-2');
  });

  it('Data saver swaps in the lighter copies (kept for next chapters), falling back to full images', async () => {
    const lite: Chapter = {
      ...MOCK_CHAPTER,
      pages: MOCK_CHAPTER.pages.map((p) => (p.pageNumber === 3 ? p : { ...p, liteCdnUrl: p.cdnUrl.replace('.webp', '.webp.lite.jpg') }))
    };
    await loadChapter(undefined, lite);
    const sources = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.vertical-flow img.page-image') as NodeListOf<HTMLImageElement>).map((img) =>
        img.getAttribute('src')!
      );
    expect(sources()).toEqual(MOCK_CHAPTER.pages.map((p) => p.cdnUrl));

    const settings = openSettings();
    const toggle = Array.from(settings.querySelectorAll('label.checkbox') as NodeListOf<HTMLLabelElement>)
      .find((label) => label.textContent?.includes('Data saver'))!
      .querySelector('input')!;
    toggle.click();
    fixture.detectChanges();

    expect(sources()).toEqual([
      'https://cdn.readora.com/p1.webp.lite.jpg',
      'https://cdn.readora.com/p2.webp.lite.jpg',
      'https://cdn.readora.com/p3.webp'
    ]);
    expect(TestBed.inject(ReaderPreferencesStore).dataSaver()).toBe(true);
    http.expectNone(`${API}/chapters/${MOCK_CHAPTER.id}`);
  });

  it('Reading with a screen reader', async () => {
    const described: Chapter = {
      ...MOCK_CHAPTER,
      pages: MOCK_CHAPTER.pages.map((p) => (p.pageNumber === 3 ? { ...p, description: 'Jinwoo stands alone in the dungeon' } : p))
    };
    await loadChapter(undefined, described);
    await switchMode('Paged');
    const announcement = (): string => fixture.nativeElement.querySelector('.page-announcement[aria-live="polite"]').textContent.trim();
    expect(announcement()).toBe('Page 1 of 3');
    expect(fixture.nativeElement.querySelector('.page-indicator').getAttribute('aria-hidden')).toBe('true');

    click('button.btn-next');
    click('button.btn-next');
    await settle(fixture);
    expect(announcement()).toBe('Page 3 of 3');
    expect(fixture.nativeElement.querySelector('.page-stage img.page-image').alt).toBe('Page 3: Jinwoo stands alone in the dungeon');

    click('button.btn-prev');
    expect(fixture.nativeElement.querySelector('.page-stage img.page-image').alt).toBe('Page 2');
  });

  it('Seeing the best comments at the end of a chapter', async () => {
    await loadChapter();
    await switchMode('Paged');
    http.expectNone((r) => r.url.endsWith('/top'));

    click('button.btn-next');
    click('button.btn-next');
    await settle(fixture);
    const req = http.expectOne(`${API}/comments/chapter/${MOCK_CHAPTER.id}/top?limit=3`);
    req.flush(ok([
        { id: 'k1', chapterId: MOCK_CHAPTER.id, authorId: 'u1', authorUsername: 'aoi', content: 'That ending!', depth: 1, isSpoiler: false, upvotes: 12, createdAt: '' },
        { id: 'k2', chapterId: MOCK_CHAPTER.id, authorId: 'u2', authorUsername: 'kenji', content: 'Art is gorgeous', depth: 1, isSpoiler: false, upvotes: 4, createdAt: '' }
      ]));
    await settle(fixture);

    const items: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.top-comments li'));
    expect(items.map((li) => li.querySelector('p')!.textContent)).toEqual(['That ending!', 'Art is gorgeous']);
    expect(items[0].querySelector('a')!.getAttribute('href')).toBe('/u/aoi');

    // Going back a page keeps them; nothing is fetched again.
    click('button.btn-prev');
    click('button.btn-next');
    await settle(fixture);
    http.expectNone((r) => r.url.endsWith('/top'));
    expect(fixture.nativeElement.querySelectorAll('.top-comments li')).toHaveLength(2);
  });

  function openSettings(): HTMLElement {
    toolbarButton('Settings').click();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('#reader-settings');
  }

  function choose(label: string, value: string): void {
    const field = Array.from(fixture.nativeElement.querySelectorAll('#reader-settings label') as NodeListOf<HTMLLabelElement>).find((l) =>
      l.textContent!.includes(label)
    )!;
    const select = field.querySelector('select')!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('Fitting the page to my screen', async () => {
    await loadChapter();
    const settings = openSettings();
    expect(settings.hidden).toBe(false);
    expect(toolbarButton('Settings').getAttribute('aria-expanded')).toBe('true');
    const body = (): HTMLElement => fixture.nativeElement.querySelector('app-vertical-flow, app-paged-flow');
    expect(body().classList).toContain('fit-width');

    choose('Page size', 'HEIGHT');
    expect(body().classList).toContain('fit-height');
    choose('Page size', 'ORIGINAL');
    expect(body().classList).toContain('fit-original');

    // Kept for the next chapters.
    await loadChapter(undefined, { ...MOCK_CHAPTER, id: 'chap-11-uuid' });
    expect(body().classList).toContain('fit-original');
  });

  it('closes the settings with Escape and gives focus back to the Settings button', async () => {
    await loadChapter();
    const settings = openSettings();
    expect(settings.hidden).toBe(false);
    press('Escape');
    expect(settings.hidden).toBe(true);
    expect(document.activeElement).toBe(toolbarButton('Settings'));
  });

  it('Changing the background colour', async () => {
    await loadChapter();
    openSettings();
    const container = (): HTMLElement => fixture.nativeElement.querySelector('.viewer-container');
    expect(container().classList).toContain('bg-black');

    choose('Background', 'GRAY');
    expect(container().classList).toContain('bg-gray');
    choose('Background', 'WHITE');
    expect(container().classList).toContain('bg-white');
  });

  it('Reading two pages side by side', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const book: Chapter = {
      ...chapterOf('op-1', 'one-piece', 'MANGA'),
      pages: [1, 2, 3, 4, 5].map((n) => ({ pageNumber: n, storageKey: `p${n}`, cdnUrl: `https://cdn.readora.com/p${n}.webp` }))
    };
    await loadChapter(undefined, book);
    openSettings();
    const toggle: HTMLInputElement = fixture.nativeElement.querySelector('#reader-settings input[type="checkbox"]');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const shown = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.page-stage img.page-image') as NodeListOf<HTMLImageElement>).map((img) => img.alt);
    expect(shown()).toEqual(['Page 1']); // the cover stands alone
    click('button.btn-next');
    // Right-to-left manga: page 2 on the right, page 3 on the left.
    expect(shown()).toEqual(['Page 3', 'Page 2']);
    click('button.btn-next');
    expect(shown()).toEqual(['Page 5', 'Page 4']);
    expect(stateService.isLastPage()).toBe(true);
    click('button.btn-prev');
    expect(shown()).toEqual(['Page 3', 'Page 2']);

  });

  it('offers double page only on wide screens', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
    await loadChapter(undefined, chapterOf('op-1', 'one-piece', 'MANGA'));
    expect(openSettings().textContent).not.toContain('Double page');
  });

  it('Letting a webtoon scroll by itself', async () => {
    // The viewer drives the document's own window. Angular's scheduler also uses animation frames, so frames are
    // tracked by id and cancelling one never drops the others.
    const win = document.defaultView!;
    const frames = new Map<number, FrameRequestCallback>();
    let lastId = 0;
    vi.spyOn(win, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      frames.set(++lastId, cb);
      return lastId;
    });
    vi.spyOn(win, 'cancelAnimationFrame').mockImplementation((id: number) => frames.delete(id));
    const scrollBy = vi.spyOn(win, 'scrollBy').mockImplementation(() => undefined);
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 100_000 });
    const runFrames = (at: number) => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((cb) => cb(at));
    };

    await loadChapter(undefined, chapterOf('sl-1', 'solo-leveling', 'MANHWA'));
    toolbarButton('Auto-scroll').click();
    fixture.detectChanges();
    expect(toolbarButton('Auto-scroll').getAttribute('aria-pressed')).toBe('true');

    runFrames(0);
    runFrames(1000); // one second at medium speed
    expect(scrollBy).toHaveBeenLastCalledWith(0, 60);

    document.dispatchEvent(new Event('wheel'));
    fixture.detectChanges();
    expect(toolbarButton('Auto-scroll').getAttribute('aria-pressed')).toBe('false');
    const calls = scrollBy.mock.calls.length;
    runFrames(2000);
    expect(scrollBy.mock.calls.length).toBe(calls);

    // Faster setting, then a touch stops it too.
    openSettings();
    choose('Auto-scroll speed', 'FAST');
    toolbarButton('Auto-scroll').click();
    runFrames(3000);
    runFrames(3500);
    expect(scrollBy).toHaveBeenLastCalledWith(0, 60);
    document.dispatchEvent(new Event('touchstart'));
    fixture.detectChanges();
    expect(toolbarButton('Auto-scroll').getAttribute('aria-pressed')).toBe('false');
    delete (document.documentElement as unknown as Record<string, unknown>)['scrollHeight'];
  });

  it('Reading in zen mode', async () => {
    await loadChapter();
    freezeTime();
    const layout = TestBed.inject(LayoutStore);
    const controlsHidden = (): boolean => fixture.nativeElement.querySelector('.reader-controls').classList.contains('controls-hidden');

    toolbarButton('Zen mode').click();
    fixture.detectChanges();
    expect(layout.immersive()).toBe(true); // the shell hides the site header
    expect(controlsHidden()).toBe(true);

    document.dispatchEvent(new MouseEvent('mousemove'));
    fixture.detectChanges();
    expect(controlsHidden()).toBe(false);
    await elapse(ZEN_CONTROLS_HIDE_MS - 100);
    expect(controlsHidden()).toBe(false);
    await elapse(100);
    expect(controlsHidden()).toBe(true);

    // A tap shows them too, and keyboard focus on a control keeps them reachable.
    document.dispatchEvent(new MouseEvent('pointerdown'));
    fixture.detectChanges();
    expect(controlsHidden()).toBe(false);

    press('Escape');
    expect(layout.immersive()).toBe(false);
    expect(controlsHidden()).toBe(false);
    expect(toolbarButton('Zen mode').getAttribute('aria-pressed')).toBe('false');
  });

  it('leaves zen mode when the reader is closed', async () => {
    await loadChapter();
    toolbarButton('Zen mode').click();
    expect(TestBed.inject(LayoutStore).immersive()).toBe(true);

    fixture.destroy();
    expect(TestBed.inject(LayoutStore).immersive()).toBe(false);
  });

  it('reports the current page to the team (US-06), with the reason chosen', async () => {
    await signIn(store, http, mockUser({ permissions: ['PAGE_REPORT'] }));
    await loadChapter();
    await switchMode('Paged');
    click('button.btn-next');

    toolbarButton('Report page').click();
    await settle(fixture);
    const [dialog] = await fixture.getDeferBlocks();
    await dialog.render(DeferBlockState.Complete);
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('#report-title').textContent).toContain('Report page 2');

    // Arrow keys inside the dialog don't turn pages.
    press('ArrowRight', {}, fixture.nativeElement.querySelector('[role="dialog"] input'));
    expect(stateService.currentPageIndex()).toBe(1);

    const missing: HTMLInputElement = fixture.nativeElement.querySelector('input[value="MISSING_PAGE"]');
    missing.click();
    fixture.nativeElement.querySelector('[role="dialog"] form').dispatchEvent(new Event('submit', { cancelable: true }));
    const req = http.expectOne(`${API}/chapters/${MOCK_CHAPTER.id}/pages/2/reports`);
    expect(req.request.body).toEqual({ reason: 'MISSING_PAGE' });
    req.flush(ok({ id: 'r-1' }));
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.report-confirmation').textContent).toContain('Page 2 was reported');
  });

  it('keeps the report dialog open with the reason when sending fails', async () => {
    await signIn(store, http, mockUser({ permissions: ['PAGE_REPORT'] }));
    await loadChapter();
    toolbarButton('Report page').click();
    await settle(fixture);
    const [dialog] = await fixture.getDeferBlocks();
    await dialog.render(DeferBlockState.Complete);
    await settle(fixture);

    fixture.nativeElement.querySelector('[role="dialog"] form').dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne(`${API}/chapters/${MOCK_CHAPTER.id}/pages/1/reports`).flush(fail('Chapter 10 has no page 1'), { status: 400, statusText: 'Bad Request' });
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[role="dialog"] [role="alert"]').textContent).toContain('has no page 1');
  });

  it('hides "Report page" from readers without PAGE_REPORT', async () => {
    await loadChapter();
    expect(toolbarButton('Report page')).toBeUndefined();
  });

  it('records the visit, then the finish, for the reading history (free readers with LIBRARY_USE)', async () => {
    await signIn(store, http, mockUser({ permissions: ['LIBRARY_USE'] }));
    await loadChapter();

    const opened = http.expectOne(`${API}/reading/chapters/${MOCK_CHAPTER.id}`);
    expect(opened.request.method).toBe('PUT');
    expect(opened.request.body).toEqual({ finished: false });
    opened.flush(fail('down'));

    await switchMode('Paged');
    click('button.btn-next');
    await settle(fixture);
    http.expectNone(`${API}/reading/chapters/${MOCK_CHAPTER.id}`);
    click('button.btn-next');
    await settle(fixture);

    const finished = http.expectOne(`${API}/reading/chapters/${MOCK_CHAPTER.id}`);
    expect(finished.request.body).toEqual({ finished: true });
    finished.flush(ok(null));

    click('button.btn-prev');
    click('button.btn-next');
    await settle(fixture);
    http.expectNone(`${API}/reading/chapters/${MOCK_CHAPTER.id}`);
  });
});
