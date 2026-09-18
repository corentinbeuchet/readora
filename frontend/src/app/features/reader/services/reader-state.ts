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

  readonly currentChapter = this._currentChapter.asReadonly();
  readonly currentPageIndex = this._currentPageIndex.asReadonly();
  readonly viewMode = this._viewMode.asReadonly();
  /** Page-turn direction in paged mode: `RTL` for Japanese manga (next page is on the left). */
  readonly direction = this._direction.asReadonly();
  readonly zoomLevel = this._zoomLevel.asReadonly();

  readonly totalPages = computed(() => this._currentChapter()?.pages.length ?? 0);

  readonly currentPage = computed<PageAsset | null>(() => {
    const chapter = this._currentChapter();
    const index = this._currentPageIndex();
    if (!chapter || chapter.pages.length === 0) {
      return null;
    }
    return chapter.pages[index] ?? null;
  });

  readonly isFirstPage = computed(() => this._currentPageIndex() === 0);
  readonly isLastPage = computed(() => {
    const total = this.totalPages();
    return total === 0 || this._currentPageIndex() >= total - 1;
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
    if (!this.isLastPage()) {
      this._currentPageIndex.update(i => i + 1);
    }
  }

  previousPage(): void {
    if (!this.isFirstPage()) {
      this._currentPageIndex.update(i => i - 1);
    }
  }
}
