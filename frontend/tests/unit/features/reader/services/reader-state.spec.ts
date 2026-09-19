import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ReaderState } from '@app/features/reader/services/reader-state';
import { ReaderPreferencesStore } from '@app/features/reader/services/reader-preferences-store';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { Chapter } from '@app/core/models/readora.models';
import { MemoryStorage } from '../../../test-utils';

const pages = (n: number) => Array.from({ length: n }, (_, i) => ({ pageNumber: i + 1, storageKey: `p${i + 1}`, cdnUrl: `c${i + 1}` }));
const CHAPTER: Chapter = { id: 'chap-1', workId: 'work-1', chapterNumber: '1', title: 'Chapter 1', status: 'PUBLISHED', pages: pages(3) };

describe('ReaderState (derived reader state)', () => {
  let state: ReaderState;
  const chapter = signal<Chapter | null>(null);
  const start = signal<number | null>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ReaderState, { provide: BrowserStorage, useClass: MemoryStorage }] });
    state = TestBed.inject(ReaderState);
    chapter.set(null);
    start.set(null);
    state.connect(chapter, start);
  });

  it('is empty until a chapter is shown', () => {
    expect(state.currentChapter()).toBeNull();
    expect(state.currentPageIndex()).toBe(0);
    expect(state.viewMode()).toBe('VERTICAL');
    expect(state.totalPages()).toBe(0);
    expect(state.currentPage()).toBeNull();
  });

  it('opens a chapter on its first page, or on ?page (clamped), and resets for the next chapter', () => {
    chapter.set(CHAPTER);
    expect(state.currentPage()?.pageNumber).toBe(1);
    expect(state.isFirstPage()).toBe(true);
    expect(state.isLastPage()).toBe(false);

    state.nextPage();
    state.nextPage();
    expect(state.currentPageIndex()).toBe(2);
    expect(state.isLastPage()).toBe(true);
    state.nextPage();
    expect(state.currentPageIndex()).toBe(2);
    state.previousPage();
    expect(state.currentPageIndex()).toBe(1);

    chapter.set({ ...CHAPTER, id: 'chap-2' });
    expect(state.currentPageIndex()).toBe(0);

    start.set(99);
    expect(state.currentPageIndex()).toBe(2);
  });

  it('keeps the page when the same chapter is reloaded', () => {
    chapter.set(CHAPTER);
    state.nextPage();
    chapter.set({ ...CHAPTER });
    expect(state.currentPageIndex()).toBe(1);
  });

  it("uses the series' saved layout only after hydration, and the reader's switch until the next chapter", () => {
    TestBed.inject(ReaderPreferencesStore).saveLayout('work-1', { mode: 'PAGED', direction: 'RTL' });
    chapter.set(CHAPTER);
    expect(state.viewMode()).toBe('VERTICAL');

    state.markHydrated();
    expect(state.viewMode()).toBe('PAGED');
    expect(state.direction()).toBe('RTL');

    state.setViewMode('VERTICAL');
    expect(state.viewMode()).toBe('VERTICAL');
  });

  it('clamps the zoom level', () => {
    state.setZoom(250);
    expect(state.zoomLevel()).toBe(200);
    state.setZoom(30);
    expect(state.zoomLevel()).toBe(50);
  });

  it('double page: cover alone, then pairs; only in paged mode on a wide screen', () => {
    TestBed.inject(ReaderPreferencesStore).setDoublePage(true);
    chapter.set({ ...CHAPTER, pages: pages(5) });
    start.set(3); // page 4
    state.setViewMode('PAGED');
    expect(state.doublePage()).toBe(false);

    state.setWideScreen(true);
    expect(state.currentSpread().map((p) => p.pageNumber)).toEqual([4, 5]);
    expect(state.isLastPage()).toBe(true);
    state.previousPage();
    expect(state.currentSpread().map((p) => p.pageNumber)).toEqual([2, 3]);
    state.previousPage();
    expect(state.currentSpread().map((p) => p.pageNumber)).toEqual([1]);
    expect(state.isFirstPage()).toBe(true);
    state.nextPage();
    expect(state.currentSpread().map((p) => p.pageNumber)).toEqual([2, 3]);

    state.setViewMode('VERTICAL');
    expect(state.doublePage()).toBe(false);
    expect(state.currentSpread().map((p) => p.pageNumber)).toEqual([2]);
  });
});
