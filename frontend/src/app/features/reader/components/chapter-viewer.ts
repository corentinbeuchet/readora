import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Toolbar, ToolbarWidget, ToolbarWidgetGroup } from '@angular/aria/toolbar';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookmarksApi } from '@app/core/api/bookmarks-api';
import { ChaptersApi } from '@app/core/api/chapters-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { ChapterComments } from '@app/features/social/components/chapter-comments';
import { ReaderState } from '../services/reader-state';

export const PROGRESS_SYNC_DEBOUNCE_MS = 800;

interface ProgressUpdate {
  workId: string;
  chapterId: string;
  pageIndex: number;
}

@Component({
  selector: 'app-chapter-viewer',
  imports: [RouterLink, Toolbar, ToolbarWidget, ToolbarWidgetGroup, HasPermissionDirective, ChapterComments],
  templateUrl: './chapter-viewer.html',
  styleUrl: './chapter-viewer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChapterViewer {
  readonly state = inject(ReaderState);
  protected readonly auth = inject(AuthStore);
  private readonly chaptersApi = inject(ChaptersApi);
  private readonly bookmarksApi = inject(BookmarksApi);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from `read/:chapterId`; `undefined` when the viewer is used standalone with a preloaded chapter. */
  readonly chapterId = input<string | undefined>(undefined);

  protected readonly chapter = this.chaptersApi.chapterResource(this.chapterId, this.state.viewMode);
  protected readonly canSaveProgress = computed(() => this.auth.can('BOOKMARK_WRITE'));
  protected readonly syncStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  private readonly progress$ = new Subject<ProgressUpdate>();

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
          this.state.setChapter(loaded);
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
      this.progress$.next({ workId: current.workId, chapterId: current.id, pageIndex: pageIndex + 1 });
    });

    this.progress$
      .pipe(
        debounceTime(PROGRESS_SYNC_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => a.workId === b.workId && a.chapterId === b.chapterId && a.pageIndex === b.pageIndex),
        switchMap((update) => {
          this.syncStatus.set('saving');
          return this.bookmarksApi.updateProgress(update.workId, { chapterId: update.chapterId, pageIndex: update.pageIndex });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.syncStatus.set('saved'),
        error: () => this.syncStatus.set('error')
      });
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
