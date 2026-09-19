import { DestroyRef, Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, scan, switchMap } from 'rxjs';
import { BookmarksApi } from '@app/core/api/bookmarks-api';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReaderState } from './reader-state';

export const PROGRESS_SYNC_DEBOUNCE_MS = 800;

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Position {
  workId: string;
  chapterId: string;
  /** 1-based page number, sent as `pageIndex` (backend validates `@Min(1)`). */
  pageNumber: number;
}

/**
 * What the reader has read, provided by the reader page next to [ReaderState]:
 * - reading history and read markers (free, `LIBRARY_USE`): the visit of a chapter, then its finish;
 * - the Premium exact-page bookmark (`BOOKMARK_WRITE`): page moves, debounced.
 */
@Service({ autoProvided: false })
export class ReadingTracker {
  private readonly state = inject(ReaderState);
  private readonly auth = inject(AuthStore);
  private readonly bookmarksApi = inject(BookmarksApi);
  private readonly readingApi = inject(ReadingApi);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _syncStatus = signal<SyncStatus>('idle');
  readonly syncStatus = this._syncStatus.asReadonly();

  /** What was already sent for the current chapter: once on open, once when the last page is reached. */
  private recorded: { chapterId: string; finished: boolean } | null = null;

  private readonly position = computed<Position | null>(
    () => {
      const chapter = this.state.currentChapter();
      return chapter ? { workId: chapter.workId, chapterId: chapter.id, pageNumber: this.state.currentPageIndex() + 1 } : null;
    },
    { equal: (a, b) => a?.chapterId === b?.chapterId && a?.pageNumber === b?.pageNumber }
  );

  constructor() {
    // History: record the visit, then the finish (a side effect towards the API, not state).
    effect(() => {
      const chapter = this.state.currentChapter();
      const atEnd = this.state.isLastPage();
      if (chapter && untracked(() => this.auth.can('LIBRARY_USE'))) {
        untracked(() => this.recordRead(chapter.id, atEnd));
      }
    });

    // Premium bookmark. The first position of each chapter is where it opened (restored page or page 1): it is never
    // saved by itself, so opening a chapter doesn't overwrite the saved bookmark. Only moves away from it are saved.
    toObservable(this.position)
      .pipe(
        scan((acc, current) => ({ previous: acc.current, current }), { previous: null as Position | null, current: null as Position | null }),
        map(({ previous, current }) => (current && previous?.chapterId === current.chapterId ? current : null)),
        filter((position): position is Position => position !== null && this.auth.can('BOOKMARK_WRITE')),
        debounceTime(PROGRESS_SYNC_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => a.workId === b.workId && a.chapterId === b.chapterId && a.pageNumber === b.pageNumber),
        switchMap((position) => {
          this._syncStatus.set('saving');
          // Own catchError: one failed save (network, 400 unpublished chapter, 404) must not complete the outer
          // stream, otherwise progress is never saved again.
          return this.bookmarksApi.updateProgress(position.workId, { chapterId: position.chapterId, pageIndex: position.pageNumber }).pipe(
            map((): SyncStatus => 'saved'),
            catchError(() => of<SyncStatus>('error'))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((status) => this._syncStatus.set(status));
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
}
