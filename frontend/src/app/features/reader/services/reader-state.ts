import { Service, computed, signal } from '@angular/core';
import { Chapter, PageAsset } from '@app/core/models/readora.models';
import { ReadingDirection, ViewMode } from './reader-preferences-store';

export type { ViewMode };

@Service()
export class ReaderState {
  private readonly _currentChapter = signal<Chapter | null>(null);
  private readonly _currentPageIndex = signal<number>(0);
  private readonly _viewMode = signal<ViewMode>('VERTICAL');
  private readonly _direction = signal<ReadingDirection>('LTR');
  private readonly _zoomLevel = signal<number>(100);
  private readonly _doublePage = signal(false);

  readonly currentChapter = this._currentChapter.asReadonly();
  readonly currentPageIndex = this._currentPageIndex.asReadonly();
  readonly viewMode = this._viewMode.asReadonly();
  /** Page-turn direction in paged mode: `RTL` for Japanese manga (next page is on the left). */
  readonly direction = this._direction.asReadonly();
  readonly zoomLevel = this._zoomLevel.asReadonly();
  /** Two pages side by side (paged mode on wide screens): page 1 alone like a cover, then 2–3, 4–5… */
  readonly doublePage = this._doublePage.asReadonly();

  readonly totalPages = computed(() => this._currentChapter()?.pages.length ?? 0);

  readonly currentPage = computed<PageAsset | null>(() => {
    const chapter = this._currentChapter();
    const index = this._currentPageIndex();
    if (!chapter || chapter.pages.length === 0) {
      return null;
    }
    return chapter.pages[index] ?? null;
  });

  /** Pages on screen, in reading order: one page, or a spread in double-page mode. */
  readonly currentSpread = computed<PageAsset[]>(() => {
    const pages = this._currentChapter()?.pages ?? [];
    if (!this._doublePage()) {
      const page = this.currentPage();
      return page ? [page] : [];
    }
    const start = spreadStart(this._currentPageIndex());
    return pages.slice(start, start === 0 ? 1 : start + 2);
  });

  readonly isFirstPage = computed(() => this._currentPageIndex() === 0);
  readonly isLastPage = computed(() => {
    const total = this.totalPages();
    if (total === 0) {
      return true;
    }
    const index = this._currentPageIndex();
    const lastShown = this._doublePage() && index > 0 ? spreadStart(index) + 1 : index;
    return lastShown >= total - 1;
  });

  /** Loads a chapter and positions the reader on `startIndex` (0-based, clamped to the chapter). */
  setChapter(chapter: Chapter, startIndex = 0): void {
    const last = Math.max(0, chapter.pages.length - 1);
    const index = Number.isInteger(startIndex) ? Math.min(Math.max(0, startIndex), last) : 0;
    this._currentChapter.set(chapter);
    this._currentPageIndex.set(index);
  }

  setViewMode(mode: ViewMode): void {
    this._viewMode.set(mode);
  }

  setDirection(direction: ReadingDirection): void {
    this._direction.set(direction);
  }

  setDoublePage(enabled: boolean): void {
    this._doublePage.set(enabled);
    if (enabled) {
      this._currentPageIndex.update(spreadStart);
    }
  }

  setZoom(percent: number): void {
    const clamped = Math.max(50, Math.min(200, percent));
    this._zoomLevel.set(clamped);
  }

  goToPage(index: number): void {
    const total = this.totalPages();
    if (index >= 0 && index < total) {
      this._currentPageIndex.set(index);
    }
  }

  nextPage(): void {
    if (this.isLastPage()) {
      return;
    }
    if (this._doublePage()) {
      const start = spreadStart(this._currentPageIndex());
      this._currentPageIndex.set(start === 0 ? 1 : start + 2);
    } else {
      this._currentPageIndex.update((i) => i + 1);
    }
  }

  previousPage(): void {
    if (this.isFirstPage()) {
      return;
    }
    if (this._doublePage()) {
      const start = spreadStart(this._currentPageIndex());
      this._currentPageIndex.set(Math.max(0, start - 2));
    } else {
      this._currentPageIndex.update((i) => i - 1);
    }
  }
}

/** First page index of the spread showing `index`: 0 alone, then pairs starting at odd indexes (pages 2–3, 4–5…). */
function spreadStart(index: number): number {
  return index === 0 ? 0 : index % 2 === 1 ? index : index - 1;
}
