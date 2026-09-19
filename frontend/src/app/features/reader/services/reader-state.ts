import { Service, Signal, computed, inject, linkedSignal, signal } from '@angular/core';
import { Chapter, PageAsset } from '@app/core/models/readora.models';
import { ReaderPreferencesStore, ReadingDirection, SeriesLayout, ViewMode } from './reader-preferences-store';

export type { ViewMode };

/** Layout before hydration (and of the prerendered HTML): saved layouts live in the browser. */
const INITIAL_LAYOUT: SeriesLayout = { mode: 'VERTICAL', direction: 'LTR' };

interface ReaderSource {
  chapter: Signal<Chapter | null>;
  /** 0-based page to open the chapter on (`?page=N`), `null` for the first page. */
  startIndex: Signal<number | null>;
}

/**
 * State of the chapter being read. Page-scoped: provided by the reader page (`providers: [ReaderState]`), so every
 * visit of the reader starts clean.
 *
 * Everything is derived from the chapter the page is showing ([connect]) and the reader's preferences; the reader's
 * own moves (turning pages, switching mode) override the derived values until another chapter opens
 * (`linkedSignal`). No effect copies state around.
 */
@Service({ autoProvided: false })
export class ReaderState {
  private readonly prefs = inject(ReaderPreferencesStore);
  private readonly source = signal<ReaderSource | null>(null);
  private readonly _hydrated = signal(false);
  private readonly _wideScreen = signal(false);
  private readonly _zoomLevel = signal<number>(100);

  readonly currentChapter = computed(() => this.source()?.chapter() ?? null);
  readonly totalPages = computed(() => this.currentChapter()?.pages.length ?? 0);

  /** Where the current chapter opens: changes only when another chapter (or `?page`) is opened. */
  private readonly opening = computed(
    () => {
      const chapter = this.currentChapter();
      const start = this.source()?.startIndex() ?? 0;
      const last = Math.max(0, (chapter?.pages.length ?? 1) - 1);
      return { chapterId: chapter?.id ?? null, index: Number.isInteger(start) ? Math.min(Math.max(0, start), last) : 0 };
    },
    { equal: (a, b) => a.chapterId === b.chapterId && a.index === b.index }
  );
  /** Page the reader is on; reset to the opening page for each chapter. */
  private readonly index = linkedSignal(() => this.opening().index);

  /** The series' layout: the reader's choice for it, or the default for its format (after hydration only). */
  private readonly layout = computed(
    () => {
      const chapter = this.currentChapter();
      return chapter && this._hydrated() ? this.prefs.layoutFor(chapter.workId, chapter.work?.type) : INITIAL_LAYOUT;
    },
    { equal: (a, b) => a.mode === b.mode && a.direction === b.direction }
  );
  private readonly _viewMode = linkedSignal(() => this.layout().mode);
  private readonly _direction = linkedSignal(() => this.layout().direction);

  readonly viewMode = this._viewMode.asReadonly();
  /** Page-turn direction in paged mode: `RTL` for Japanese manga (next page is on the left). */
  readonly direction = this._direction.asReadonly();
  readonly zoomLevel = this._zoomLevel.asReadonly();
  readonly hydrated = this._hydrated.asReadonly();
  /** Double page can be offered: paged mode on a wide screen. */
  readonly canShowDoublePage = computed(() => this._viewMode() === 'PAGED' && this._wideScreen());
  /** Two pages side by side when the reader asked for it and it can be shown: page 1 alone, then 2–3, 4–5… */
  readonly doublePage = computed(() => this.prefs.doublePage() && this.canShowDoublePage());

  /** 0-based index of the (first) page on screen. */
  readonly currentPageIndex = computed(() => (this.doublePage() ? spreadStart(this.index()) : this.index()));

  readonly currentPage = computed<PageAsset | null>(() => this.currentChapter()?.pages[this.currentPageIndex()] ?? null);

  /** Pages on screen, in reading order: one page, or a spread in double-page mode. */
  readonly currentSpread = computed<PageAsset[]>(() => {
    const pages = this.currentChapter()?.pages ?? [];
    const start = this.currentPageIndex();
    if (!this.doublePage()) {
      return pages[start] ? [pages[start]] : [];
    }
    return pages.slice(start, start === 0 ? 1 : start + 2);
  });

  readonly isFirstPage = computed(() => this.currentPageIndex() === 0);
  readonly isLastPage = computed(() => {
    const total = this.totalPages();
    if (total === 0) {
      return true;
    }
    const index = this.currentPageIndex();
    const lastShown = this.doublePage() && index > 0 ? index + 1 : index;
    return lastShown >= total - 1;
  });

  /** Called once by the reader page: the chapter it shows and the page to open it on. */
  connect(chapter: Signal<Chapter | null>, startIndex: Signal<number | null>): void {
    this.source.set({ chapter, startIndex });
  }

  /** The browser took over from the prerendered HTML: saved layouts can now be applied. */
  markHydrated(): void {
    this._hydrated.set(true);
  }

  setWideScreen(wide: boolean): void {
    this._wideScreen.set(wide);
  }

  setViewMode(mode: ViewMode): void {
    this._viewMode.set(mode);
  }

  setDirection(direction: ReadingDirection): void {
    this._direction.set(direction);
  }

  setZoom(percent: number): void {
    this._zoomLevel.set(Math.max(50, Math.min(200, percent)));
  }

  goToPage(index: number): void {
    if (index >= 0 && index < this.totalPages()) {
      this.index.set(index);
    }
  }

  nextPage(): void {
    if (this.isLastPage()) {
      return;
    }
    const start = this.currentPageIndex();
    this.index.set(this.doublePage() ? (start === 0 ? 1 : start + 2) : start + 1);
  }

  previousPage(): void {
    if (this.isFirstPage()) {
      return;
    }
    const start = this.currentPageIndex();
    this.index.set(this.doublePage() ? Math.max(0, start - 2) : start - 1);
  }
}

/** First page index of the spread showing `index`: 0 alone, then pairs starting at odd indexes (pages 2–3, 4–5…). */
function spreadStart(index: number): number {
  return index === 0 ? 0 : index % 2 === 1 ? index : index - 1;
}
