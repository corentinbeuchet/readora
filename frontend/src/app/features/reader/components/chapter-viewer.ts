import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
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
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { ChapterComments } from '@app/features/social/components/chapter-comments';
import { FALLBACK_PAGE_IMAGE, onImageError } from '@app/core/utils/image-utils';
import { ReaderState } from '../services/reader-state';

export const PROGRESS_SYNC_DEBOUNCE_MS = 800;

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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChapterViewer {
  readonly state = inject(ReaderState);
  protected readonly auth = inject(AuthStore);
  protected readonly fallbackPage = FALLBACK_PAGE_IMAGE;
  protected readonly handlePageError = onImageError;
  /** Used when the API has no dimensions for a page (typical manga page ratio 2:3). */
  protected readonly defaultPageWidth = 800;
  protected readonly defaultPageHeight = 1200;
  private readonly chaptersApi = inject(ChaptersApi);
  private readonly bookmarksApi = inject(BookmarksApi);
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

  /** Switches view mode, keeping the current page (vertical mode scrolls back to it). */
  protected setViewMode(mode: 'VERTICAL' | 'PAGED'): void {
    if (mode === this.state.viewMode()) {
      return;
    }
    if (mode === 'VERTICAL') {
      this.pendingScrollIndex = this.state.currentPageIndex();
    }
    this.state.setViewMode(mode);
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
