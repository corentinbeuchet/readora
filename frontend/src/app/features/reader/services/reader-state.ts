import { Injectable, computed, signal } from '@angular/core';
import { Chapter, PageAsset } from '@app/core/models/readora.models';

export type ViewMode = 'VERTICAL' | 'PAGED';
export type ReadingDirection = 'LTR' | 'RTL' | 'VERTICAL';

@Injectable({
  providedIn: 'root'
})
export class ReaderState {
  private readonly _currentChapter = signal<Chapter | null>(null);
  private readonly _currentPageIndex = signal<number>(0);
  private readonly _viewMode = signal<ViewMode>('VERTICAL');
  private readonly _zoomLevel = signal<number>(100);
  private readonly _readingDirection = signal<ReadingDirection>('VERTICAL');

  readonly currentChapter = this._currentChapter.asReadonly();
  readonly currentPageIndex = this._currentPageIndex.asReadonly();
  readonly viewMode = this._viewMode.asReadonly();
  readonly zoomLevel = this._zoomLevel.asReadonly();
  readonly readingDirection = this._readingDirection.asReadonly();

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

  setChapter(chapter: Chapter): void {
    this._currentChapter.set(chapter);
    this._currentPageIndex.set(0);
  }

  setViewMode(mode: ViewMode): void {
    this._viewMode.set(mode);
    if (mode === 'VERTICAL') {
      this._readingDirection.set('VERTICAL');
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
