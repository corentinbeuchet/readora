import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChildren
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Toolbar, ToolbarWidget, ToolbarWidgetGroup } from '@angular/aria/toolbar';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookmarksApi } from '@app/core/api/bookmarks-api';
import { ChaptersApi } from '@app/core/api/chapters-api';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { ChapterComments } from '@app/features/social/components/chapter-comments';
import { FALLBACK_PAGE_IMAGE, onImageError } from '@app/core/utils/image-utils';
import { ReaderState } from '../services/reader-state';
import { ReaderPreferencesStore, ReadingDirection, ViewMode } from '../services/reader-preferences-store';

export const PROGRESS_SYNC_DEBOUNCE_MS = 800;
/** Pages downloaded ahead of the current one in paged mode. */
export const PRELOADED_PAGES = 2;
/** Minimum horizontal travel (px) for a touch swipe to turn the page. */
const SWIPE_THRESHOLD_PX = 50;

interface ProgressUpdate {
  workId: string;
  chapterId: string;
  /** 1-based page number, sent as `pageIndex` (backend validates `@Min(1)`). */
  pageNumber: number;
}

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Parses the `?page=N` query param (1-based) into a 0-based index, or `null` when absent/invalid. */
function pageParamToIndex(raw: string | number | null | undefined): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return raw !== null && raw !== undefined && raw !== '' && Number.isInteger(n) && n >= 1 ? n - 1 : null;
}

@Component({
  selector: 'app-chapter-viewer',
  imports: [RouterLink, NgOptimizedImage, Toolbar, ToolbarWidget, ToolbarWidgetGroup, HasPermissionDirective, ChapterComments],
  templateUrl: './chapter-viewer.html',
  styleUrl: './chapter-viewer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' }
})
export class ChapterViewer {
  readonly state = inject(ReaderState);
  protected readonly prefs = inject(ReaderPreferencesStore);
  protected readonly auth = inject(AuthStore);
  protected readonly fallbackPage = FALLBACK_PAGE_IMAGE;
  protected readonly handlePageError = onImageError;
  /** Used when the API has no dimensions for a page (typical manga page ratio 2:3). */
  protected readonly defaultPageWidth = 800;
  protected readonly defaultPageHeight = 1200;
  private readonly chaptersApi = inject(ChaptersApi);
  private readonly bookmarksApi = inject(BookmarksApi);
  private readonly readingApi = inject(ReadingApi);
  private readonly seo = inject(SeoService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from `read/:chapterId`; `undefined` when the viewer is used standalone with a preloaded chapter. */
  readonly chapterId = input<string | undefined>(undefined);
  /** Bound from the `?page=N` query param (1-based), e.g. from "Continue reading". */
  readonly page = input<string | number | undefined>(undefined);

  private readonly pageWrappers = viewChildren<ElementRef<HTMLElement>>('pageWrapper');

  protected readonly chapter = this.chaptersApi.chapterResource(this.chapterId);
  protected readonly canSaveProgress = computed(() => this.auth.can('BOOKMARK_WRITE'));
  protected readonly syncStatus = signal<SyncStatus>('idle');
  /** Free history / read markers (US-07); separate from the Premium exact-page bookmark. */
  private readonly canTrackReading = computed(() => this.auth.can('LIBRARY_USE'));
  /** What was already sent for the current chapter: once on open, once when the last page is reached. */
  private recorded: { chapterId: string; finished: boolean } | null = null;

  /** Paged mode reads right to left: arrows, swipes and click zones are mirrored. */
  protected readonly rightToLeftPages = computed(() => this.state.viewMode() === 'PAGED' && this.state.direction() === 'RTL');
  protected readonly progressPercent = computed(() => {
    const total = this.state.totalPages();
    return total === 0 ? 0 : Math.round(((this.state.currentPageIndex() + 1) / total) * 100);
  });
  /** Next pages to preload (paged mode; vertical mode lets the browser lazy-load as the reader scrolls). */
  protected readonly upcomingPages = computed(() => {
    const chapter = this.state.currentChapter();
    if (!chapter || this.state.viewMode() !== 'PAGED') {
      return [];
    }
    const from = this.state.currentPageIndex() + 1;
    return chapter.pages.slice(from, from + PRELOADED_PAGES).filter((page) => !!page.cdnUrl);
  });
  private swipeStart: { x: number; y: number } | null = null;
  /** A swipe also ends with a click on a turn zone: that click must not turn a second page. */
  private swiped = false;

  /**
   * Saved layouts live in the browser: they are applied only after hydration, so the prerendered HTML
   * (default layout) and the first client render match.
   */
  private readonly hydrated = signal(false);
  /** Chapter whose series layout was already applied (the reader may change it afterwards). */
  private layoutAppliedFor: string | null = null;

  private readonly progress$ = new Subject<ProgressUpdate>();
  /**
   * Position the reader was opened at (restored page, or page 1). It is never synced by itself:
   * opening a chapter must not overwrite the saved bookmark. Only moves away from it are saved.
   */
  private progressBaseline: { chapterId: string; pageIndex: number } | null = null;
  private userMoved = false;
  /** 0-based page to scroll to once the vertical page list is rendered. */
  private pendingScrollIndex: number | null = null;

  constructor() {
    // Feed the shared reader state each time a chapter arrives from the API.
    effect(() => {
      if (this.chapter.error()) {
        untracked(() => this.seo.notFound('Chapter unavailable'));
        return;
      }
      // `value()` throws while the resource is in error state: check `hasValue()` first.
      const loaded = this.chapter.hasValue() ? this.chapter.value() : undefined;
      if (loaded) {
        untracked(() => {
          this.state.setChapter(loaded, pageParamToIndex(this.page()) ?? 0);
          const start = this.state.currentPageIndex();
          this.progressBaseline = { chapterId: loaded.id, pageIndex: start };
          this.userMoved = false;
          this.pendingScrollIndex = start > 0 ? start : null;
          this.seo.update({
            title: `${loaded.title} — Chapter ${loaded.chapterNumber}`,
            description: `Read chapter ${loaded.chapterNumber} (${loaded.pages.length} pages) online on Readora.`,
            path: `/read/${loaded.id}`,
            image: loaded.pages[0]?.cdnUrl,
            type: 'article'
          });
        });
      }
    });

    afterNextRender(() => this.hydrated.set(true));

    // Open each chapter in its series' layout: the one the reader chose, or the default for the format.
    effect(() => {
      const current = this.state.currentChapter();
      if (!current || !this.hydrated() || this.layoutAppliedFor === current.id) {
        return;
      }
      this.layoutAppliedFor = current.id;
      untracked(() => {
        const layout = this.prefs.layoutFor(current.workId, current.work?.type);
        this.applyViewMode(layout.mode);
        this.state.setDirection(layout.direction);
      });
    });

    // Reading history and read markers: record the visit, then the finish.
    effect(() => {
      const current = this.state.currentChapter();
      const atEnd = this.state.isLastPage();
      if (current && untracked(() => this.canTrackReading())) {
        untracked(() => this.recordRead(current.id, atEnd));
      }
    });

    // Sync reading progress (debounced) only for users allowed to write bookmarks.
    effect(() => {
      const current = this.state.currentChapter();
      const pageIndex = this.state.currentPageIndex();
      if (!current || !untracked(() => this.canSaveProgress())) {
        return;
      }
      if (!this.progressBaseline || this.progressBaseline.chapterId !== current.id) {
        this.progressBaseline = { chapterId: current.id, pageIndex };
        this.userMoved = false;
        return;
      }
      if (!this.userMoved && pageIndex === this.progressBaseline.pageIndex) {
        return;
      }
      this.userMoved = true;
      this.progress$.next({ workId: current.workId, chapterId: current.id, pageNumber: pageIndex + 1 });
    });

    this.progress$
      .pipe(
        debounceTime(PROGRESS_SYNC_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => a.workId === b.workId && a.chapterId === b.chapterId && a.pageNumber === b.pageNumber),
        switchMap((update) => {
          this.syncStatus.set('saving');
          // Own catchError: one failed save (network, 400 unpublished chapter, 404) must not
          // complete the outer stream, otherwise progress is never saved again.
          return this.bookmarksApi
            .updateProgress(update.workId, { chapterId: update.chapterId, pageIndex: update.pageNumber })
            .pipe(
              map((): SyncStatus => 'saved'),
              catchError(() => of<SyncStatus>('error'))
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((status) => this.syncStatus.set(status));

    // Vertical mode: the page crossing the middle of the viewport is the current page.
    // Browser-only (afterRenderEffect never runs on the server / during prerender).
    let observer: IntersectionObserver | null = null;
    afterRenderEffect(() => {
      const wrappers = this.pageWrappers();
      observer?.disconnect();
      observer = null;
      if (wrappers.length === 0) {
        return;
      }

      const scrollTo = this.pendingScrollIndex;
      if (scrollTo !== null && wrappers[scrollTo]) {
        wrappers[scrollTo].nativeElement.scrollIntoView?.({ block: 'start' });
        this.pendingScrollIndex = null;
      }

      const Observer = this.document.defaultView?.IntersectionObserver;
      if (!Observer) {
        return;
      }
      observer = new Observer(
        (entries) => {
          for (const entry of entries) {
            const index = Number((entry.target as HTMLElement).dataset['pageIndex']);
            if (entry.isIntersecting && Number.isInteger(index)) {
              this.state.goToPage(index);
            }
          }
        },
        { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
      );
      for (const wrapper of wrappers) {
        observer.observe(wrapper.nativeElement);
      }
    });
    this.destroyRef.onDestroy(() => observer?.disconnect());
  }

  private recordRead(chapterId: string, finished: boolean): void {
    const previous = this.recorded?.chapterId === chapterId ? this.recorded : null;
    if (previous && (previous.finished || !finished)) {
      return;
    }
    this.recorded = { chapterId, finished };
    // Best effort: a failed history write must never disturb reading, and the next visit records it again.
    this.readingApi
      .recordRead(chapterId, finished)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  /**
   * Paged mode keys: arrows follow the reading direction, Space / Page Down go forward, Shift+Space / Page Up back.
   * Ignored while typing in a field or when a modifier is held (browser shortcuts); vertical mode scrolls natively.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (this.state.viewMode() !== 'PAGED' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) {
      return;
    }
    const rtl = this.state.direction() === 'RTL';
    let forward: boolean;
    switch (event.key) {
      case 'ArrowRight':
        forward = !rtl;
        break;
      case 'ArrowLeft':
        forward = rtl;
        break;
      case ' ':
        forward = !event.shiftKey;
        break;
      case 'PageDown':
        forward = true;
        break;
      case 'PageUp':
        forward = false;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.turn(forward);
  }

  /** Click zones: the side the next page is on depends on the reading direction. */
  protected turnFromSide(side: 'left' | 'right'): void {
    if (this.swiped) {
      this.swiped = false;
      return;
    }
    this.turn((side === 'right') !== (this.state.direction() === 'RTL'));
  }

  protected onPointerDown(event: PointerEvent): void {
    this.swipeStart = { x: event.clientX, y: event.clientY };
    this.swiped = false;
  }

  /** Swiping left brings the page on the right (next page left-to-right, previous page right-to-left). */
  protected onPointerUp(event: PointerEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) {
      return;
    }
    this.swiped = true;
    this.turn((dx < 0) !== (this.state.direction() === 'RTL'));
  }

  /** Range input: 1-based page number. Vertical mode scrolls to the page. */
  protected jumpToPage(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value) - 1;
    this.state.goToPage(index);
    if (this.state.viewMode() === 'VERTICAL') {
      this.pageWrappers()[index]?.nativeElement.scrollIntoView?.({ block: 'start' });
    }
  }

  private turn(forward: boolean): void {
    if (forward) {
      this.state.nextPage();
    } else {
      this.state.previousPage();
    }
  }

  /** Switches view mode, keeping the current page, and remembers it for this series. */
  protected setViewMode(mode: ViewMode): void {
    this.applyViewMode(mode);
    this.rememberLayout();
  }

  /** Paged mode only: which side the next page is on. Remembered for this series. */
  protected setDirection(direction: ReadingDirection): void {
    this.state.setDirection(direction);
    this.rememberLayout();
  }

  /** Changes the mode without saving it (vertical mode scrolls back to the current page). */
  private applyViewMode(mode: ViewMode): void {
    if (mode === this.state.viewMode()) {
      return;
    }
    if (mode === 'VERTICAL') {
      this.pendingScrollIndex = this.state.currentPageIndex();
    }
    this.state.setViewMode(mode);
  }

  private rememberLayout(): void {
    const current = this.state.currentChapter();
    if (current) {
      this.prefs.saveLayout(current.workId, { mode: this.state.viewMode(), direction: this.state.direction() });
    }
  }

  zoomIn(): void {
    this.state.setZoom(this.state.zoomLevel() + 10);
  }

  zoomOut(): void {
    this.state.setZoom(this.state.zoomLevel() - 10);
  }

  protected reload(): void {
    this.chapter.reload();
  }
}
