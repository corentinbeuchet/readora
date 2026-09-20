import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ReaderState } from '@app/features/reader/reader-page/reader-state';
import { ReaderPreferencesStore, ReadingDirection, SeriesLayout, ViewMode } from '@app/features/reader/reader-page/reader-preferences-store';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { Chapter } from '@app/core/models/chapter';
import { MemoryStorage } from '../../../test-utils';

const pages = (n: number) => Array.from({ length: n }, (_, i) => ({ pageNumber: i + 1, storageKey: `p${i + 1}`, cdnUrl: `c${i + 1}`, width: 0, height: 0, description: null, liteCdnUrl: null }));
const CHAPTER: Chapter = { id: 'chap-1', workId: 'work-1', chapterNumber: '1', title: 'Chapter 1', status: 'PUBLISHED', work: null, team: null, previousChapterId: null, nextChapterId: null, pages: pages(3) };

describe('ReaderState (derived reader state)', () => {
  let state: ReaderState;
  const shownChapter = signal<Chapter | null>(null);
  const startIndex = signal<number | null>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ReaderState, { provide: BrowserStorage, useClass: MemoryStorage }] });
    state = TestBed.inject(ReaderState);
    shownChapter.set(null);
    startIndex.set(null);
    state.connect(shownChapter, startIndex);
  });

  it('is empty until a chapter is shown', () => {
    thenNoChapterIsShown();
    thenIAmOnPageIndex(0);
    thenTheViewModeIs('VERTICAL');
    thenTheTotalPagesIs(0);
    thenThereIsNoCurrentPage();
  });

  it('opens a chapter on its first page, or on ?page (clamped), and resets for the next chapter', () => {
    whenTheChapterIsShown(CHAPTER);

    thenTheCurrentPageIs(1);
    thenIAmOnTheFirstPage();
    thenIAmNotOnTheLastPage();

    whenIGoToTheNextPage();
    whenIGoToTheNextPage();

    thenIAmOnPageIndex(2);
    thenIAmOnTheLastPage();

    whenIGoToTheNextPage();

    thenIAmOnPageIndex(2);

    whenIGoToThePreviousPage();

    thenIAmOnPageIndex(1);

    whenTheChapterIsShown({ ...CHAPTER, id: 'chap-2' });

    thenIAmOnPageIndex(0);

    whenTheStartIndexBecomes(99);

    thenIAmOnPageIndex(2);
  });

  it('keeps the page when the same chapter is reloaded', () => {
    givenTheChapterIsShown(CHAPTER);
    givenIWentToTheNextPage();

    whenTheChapterIsShown({ ...CHAPTER });

    thenIAmOnPageIndex(1);
  });

  it("uses the series' saved layout only after hydration, and the reader's switch until the next chapter", () => {
    givenTheSeriesLayoutIsSaved('work-1', { mode: 'PAGED', direction: 'RTL' });

    whenTheChapterIsShown(CHAPTER);

    thenTheViewModeIs('VERTICAL');

    whenThePageIsHydrated();

    thenTheViewModeIs('PAGED');
    thenTheDirectionIs('RTL');

    whenIChooseTheViewMode('VERTICAL');

    thenTheViewModeIs('VERTICAL');
  });

  it('clamps the zoom level', () => {
    whenISetTheZoomTo(250);

    thenTheZoomIs(200);

    whenISetTheZoomTo(30);

    thenTheZoomIs(50);
  });

  it('double page: cover alone, then pairs; only in paged mode on a wide screen', () => {
    givenDoublePageIsOn();
    givenTheChapterIsShown({ ...CHAPTER, pages: pages(5) }, { startIndex: 3 });

    whenIChooseTheViewMode('PAGED');

    thenDoublePageIsNotActive();

    whenTheScreenBecomesWide();

    thenTheSpreadShowsPages([4, 5]);
    thenIAmOnTheLastPage();

    whenIGoToThePreviousPage();

    thenTheSpreadShowsPages([2, 3]);

    whenIGoToThePreviousPage();

    thenTheSpreadShowsPages([1]);
    thenIAmOnTheFirstPage();

    whenIGoToTheNextPage();

    thenTheSpreadShowsPages([2, 3]);

    whenIChooseTheViewMode('VERTICAL');

    thenDoublePageIsNotActive();
    thenTheSpreadShowsPages([2]);
  });

  function givenTheChapterIsShown(chapter: Chapter, options: { startIndex?: number } = {}): void {
    shownChapter.set(chapter);
    startIndex.set(options.startIndex ?? null);
  }

  function givenIWentToTheNextPage(): void {
    state.nextPage();
  }

  function givenTheSeriesLayoutIsSaved(workId: string, layout: SeriesLayout): void {
    TestBed.inject(ReaderPreferencesStore).saveLayout(workId, layout);
  }

  function givenDoublePageIsOn(): void {
    TestBed.inject(ReaderPreferencesStore).setDoublePage(true);
  }

  function whenTheChapterIsShown(chapter: Chapter): void {
    shownChapter.set(chapter);
  }

  function whenTheStartIndexBecomes(index: number): void {
    startIndex.set(index);
  }

  function whenIGoToTheNextPage(): void {
    state.nextPage();
  }

  function whenIGoToThePreviousPage(): void {
    state.previousPage();
  }

  function whenThePageIsHydrated(): void {
    state.markHydrated();
  }

  function whenIChooseTheViewMode(mode: ViewMode): void {
    state.setViewMode(mode);
  }

  function whenISetTheZoomTo(percent: number): void {
    state.setZoom(percent);
  }

  function whenTheScreenBecomesWide(): void {
    state.setWideScreen(true);
  }

  function thenNoChapterIsShown(): void {
    expect(state.currentChapter()).toBeNull();
  }

  function thenIAmOnPageIndex(index: number): void {
    expect(state.currentPageIndex()).toBe(index);
  }

  function thenTheViewModeIs(mode: ViewMode): void {
    expect(state.viewMode()).toBe(mode);
  }

  function thenTheDirectionIs(direction: ReadingDirection): void {
    expect(state.direction()).toBe(direction);
  }

  function thenTheTotalPagesIs(total: number): void {
    expect(state.totalPages()).toBe(total);
  }

  function thenThereIsNoCurrentPage(): void {
    expect(state.currentPage()).toBeNull();
  }

  function thenTheCurrentPageIs(pageNumber: number): void {
    expect(state.currentPage()?.pageNumber).toBe(pageNumber);
  }

  function thenIAmOnTheFirstPage(): void {
    expect(state.isFirstPage()).toBe(true);
  }

  function thenIAmOnTheLastPage(): void {
    expect(state.isLastPage()).toBe(true);
  }

  function thenIAmNotOnTheLastPage(): void {
    expect(state.isLastPage()).toBe(false);
  }

  function thenTheZoomIs(percent: number): void {
    expect(state.zoomLevel()).toBe(percent);
  }

  function thenDoublePageIsNotActive(): void {
    expect(state.doublePage()).toBe(false);
  }

  function thenTheSpreadShowsPages(pageNumbers: number[]): void {
    expect(state.currentSpread().map((p) => p.pageNumber)).toEqual(pageNumbers);
  }
});
