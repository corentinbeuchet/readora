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
    { pageNumber: 2, storageKey: 'p2.webp', cdnUrl: 'https://cdn.readora.com/p2.webp' }
  ]
};

describe('ChapterViewer (API-driven)', () => {
  let fixture: ComponentFixture<ChapterViewer>;
  let stateService: ReaderState;
  let http: HttpTestingController;
  let store: AuthStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChapterViewer],
      providers: [ReaderState, provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    stateService = TestBed.inject(ReaderState);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(ChapterViewer);
  });

  afterEach(() => http.verify());

  const chapterUrl = (r: { url: string }) => r.url === `${API}/chapters/${MOCK_CHAPTER.id}`;

  /** Renders the viewer for `read/:chapterId`, answering the chapter + comments requests. */
  async function loadChapter(): Promise<void> {
    fixture.componentRef.setInput('chapterId', MOCK_CHAPTER.id);
    await settle(fixture);

    const req = http.expectOne(chapterUrl);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: MOCK_CHAPTER, error: null });
    await settle(fixture);

    http.match(`${API}/comments/chapter/${MOCK_CHAPTER.id}`).forEach((r) => r.flush({ success: true, data: [], error: null }));
    await settle(fixture);
  }

  async function switchToPaged(): Promise<void> {
    stateService.setViewMode('PAGED');
    await settle(fixture);
    // Switching view mode re-fetches with viewMode=PAGED, which re-feeds the state and re-mounts the comments.
    http.match(chapterUrl).forEach((r) => r.flush({ success: true, data: MOCK_CHAPTER, error: null }));
    await settle(fixture);
    http.match(`${API}/comments/chapter/${MOCK_CHAPTER.id}`).forEach((r) => r.flush({ success: true, data: [], error: null }));
    await settle(fixture);
  }

  it('loads the chapter from the API and renders all pages in vertical mode', async () => {
    await loadChapter();

    expect(stateService.currentChapter()?.id).toBe(MOCK_CHAPTER.id);
    const verticalFlow = fixture.debugElement.query(By.css('.vertical-flow'));
    expect(verticalFlow).toBeTruthy();

    const wrappers = fixture.debugElement.queryAll(By.css('.vertical-flow .page-wrapper'));
    expect(wrappers.length).toBe(2);
    expect(wrappers[0].nativeElement.getAttribute('data-page')).toBe('1');
    expect(wrappers[1].nativeElement.getAttribute('data-page')).toBe('2');

    const images = fixture.debugElement.queryAll(By.css('.vertical-flow .page-image'));
    expect(images.length).toBe(2);
    expect(images[0].nativeElement.src).toContain('https://cdn.readora.com/p1.webp');
    expect(images[1].nativeElement.src).toContain('https://cdn.readora.com/p2.webp');
    expect(fixture.nativeElement.querySelector('h1.chapter-title').textContent).toContain('Chapter 10');
  });

  it('renders single page and navigation in paged mode', async () => {
    await loadChapter();
    await switchToPaged();

    const activeImage = fixture.debugElement.query(By.css('img.active-page'));
    expect(activeImage).toBeTruthy();
    expect(activeImage.nativeElement.src).toContain('https://cdn.readora.com/p1.webp');

    fixture.debugElement.query(By.css('button.btn-next')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('img.active-page')).nativeElement.src).toContain('https://cdn.readora.com/p2.webp');
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

    expect(fixture.nativeElement.querySelector('.sync-hint').textContent).toContain('Go Premium');
    stateService.nextPage();
    await settle(fixture);
    await new Promise((r) => setTimeout(r, PROGRESS_SYNC_DEBOUNCE_MS + 50));
    http.expectNone((r) => r.url.includes('/bookmarks/'));
  });

  it('debounces and syncs reading progress for a PREMIUM reader', async () => {
    await signIn(store, http, mockUser({ permissions: ['COMMENT_WRITE', 'BOOKMARK_READ', 'BOOKMARK_WRITE'] }));
    await loadChapter();

    expect(fixture.nativeElement.querySelector('.sync-hint').textContent).toContain('Progress is saved automatically');
    await switchToPaged();

    stateService.nextPage();
    await settle(fixture);
    // Nothing is sent before the debounce window elapses.
    http.expectNone((r) => r.url.includes('/bookmarks/'));
    await new Promise((r) => setTimeout(r, PROGRESS_SYNC_DEBOUNCE_MS + 50));

    const progress = http.expectOne(`${API}/bookmarks/${MOCK_CHAPTER.workId}/progress`);
    expect(progress.request.method).toBe('PUT');
    expect(progress.request.body).toEqual({ chapterId: MOCK_CHAPTER.id, pageIndex: 2 });
    progress.flush({ success: true, data: { workId: MOCK_CHAPTER.workId, lastReadChapterId: MOCK_CHAPTER.id, lastReadPageIndex: 2, status: 'READING', updatedAt: '' }, error: null });
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('.sync-hint').textContent).toContain('Progress saved');
  });
});
