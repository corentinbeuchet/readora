import { TestBed } from '@angular/core/testing';
import { ReaderState } from '@app/features/reader/services/reader-state';
import { Chapter } from '@app/core/models/readora.models';

const MOCK_CHAPTER: Chapter = {
  id: 'chap-1-uuid',
  workId: 'work-1-uuid',
  chapterNumber: '1',
  title: 'Chapter 1: The Beginning',
  status: 'PUBLISHED',
  pages: [
    { pageNumber: 1, storageKey: 'p1.webp', cdnUrl: 'https://cdn.readora.com/p1.webp' },
    { pageNumber: 2, storageKey: 'p2.webp', cdnUrl: 'https://cdn.readora.com/p2.webp' },
    { pageNumber: 3, storageKey: 'p3.webp', cdnUrl: 'https://cdn.readora.com/p3.webp' }
  ]
};

describe('ReaderState (Signals)', () => {
  let service: ReaderState;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReaderState]
    });
    service = TestBed.inject(ReaderState);
  });

  it('should initialize with default state', () => {
    expect(service.currentChapter()).toBeNull();
    expect(service.currentPageIndex()).toBe(0);
    expect(service.viewMode()).toBe('VERTICAL');
    expect(service.totalPages()).toBe(0);
    expect(service.currentPage()).toBeNull();
  });

  it('should update computed state when chapter is set', () => {
    service.setChapter(MOCK_CHAPTER);

    expect(service.currentChapter()).toEqual(MOCK_CHAPTER);
    expect(service.totalPages()).toBe(3);
    expect(service.currentPage()?.pageNumber).toBe(1);
    expect(service.isFirstPage()).toBe(true);
    expect(service.isLastPage()).toBe(false);
  });

  it('should handle page navigation correctly', () => {
    service.setChapter(MOCK_CHAPTER);

    service.nextPage();
    expect(service.currentPageIndex()).toBe(1);
    expect(service.currentPage()?.pageNumber).toBe(2);
    expect(service.isFirstPage()).toBe(false);

    service.nextPage();
    expect(service.currentPageIndex()).toBe(2);
    expect(service.isLastPage()).toBe(true);

    // Trying to go beyond last page should do nothing
    service.nextPage();
    expect(service.currentPageIndex()).toBe(2);

    service.previousPage();
    expect(service.currentPageIndex()).toBe(1);
  });

  it('should toggle view mode and clamp zoom level', () => {
    service.setViewMode('PAGED');
    expect(service.viewMode()).toBe('PAGED');

    service.setZoom(250);
    expect(service.zoomLevel()).toBe(200);

    service.setZoom(30);
    expect(service.zoomLevel()).toBe(50);
  });
});
