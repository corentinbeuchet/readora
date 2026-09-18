import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { ChapterViewer, PROGRESS_SYNC_DEBOUNCE_MS } from '@app/features/reader/components/chapter-viewer';
import { ReaderState } from '@app/features/reader/services/reader-state';
import { AuthStore } from '@app/core/auth/auth-store';
import { Chapter } from '@app/core/models/readora.models';
import { environment } from '../../../../../src/environments/environment';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { settle } from '../../../test-utils';

const API = environment.apiUrl;

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

describe('ChapterViewer (API-driven)', () => {
  let fixture: ComponentFixture<ChapterViewer>;
  let stateService: ReaderState;
  let http: HttpTestingController;
  let store: AuthStore;

  beforeEach(async () => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    await TestBed.configureTestingModule({
      imports: [ChapterViewer],
      providers: [ReaderState, provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    stateService = TestBed.inject(ReaderState);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(ChapterViewer);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    http.verify();
  });

  const chapterUrl = (r: { url: string }) => r.url === `${API}/chapters/${MOCK_CHAPTER.id}`;
  const commentsUrl = `${API}/comments/chapter/${MOCK_CHAPTER.id}`;

  /** Renders the viewer for `read/:chapterId[?page=N]`, answering the chapter + comments requests. */
  async function loadChapter(page?: string): Promise<void> {
    fixture.componentRef.setInput('chapterId', MOCK_CHAPTER.id);
    if (page !== undefined) {
      fixture.componentRef.setInput('page', page);
    }
    await settle(fixture);

    const req = http.expectOne(chapterUrl);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: MOCK_CHAPTER, error: null });
    await settle(fixture);

    http.match(commentsUrl).forEach((r) => r.flush({ success: true, data: [], error: null }));
    await settle(fixture);
  }

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
    http.expectOne((r) => r.url === `${API}/chapters/unknown`).flush({ success: false, data: null, error: 'not found' }, { status: 404, statusText: 'Not Found' });
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
    progress.flush({ success: true, data: { workId: MOCK_CHAPTER.workId, lastReadChapterId: MOCK_CHAPTER.id, lastReadPageIndex: 2, status: 'READING', updatedAt: '' }, error: null });
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
    http.expectOne(PROGRESS_URL).flush({ success: false, data: null, error: 'CHAPTER_NOT_PUBLISHED' }, { status: 400, statusText: 'Bad Request' });
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
    retry.flush({ success: true, data: { workId: MOCK_CHAPTER.workId, lastReadChapterId: MOCK_CHAPTER.id, lastReadPageIndex: 2, status: 'READING', updatedAt: '' }, error: null });
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
});
