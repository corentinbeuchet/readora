import { Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { firstValueFrom } from 'rxjs';
import { asyncAction } from '@app/core/utils/async-action';
import { BookmarksApi } from '@app/core/api/bookmarks-api';
import { LibraryApi } from '@app/core/api/library-api';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { WorkRatings } from './work-ratings/work-ratings';
import { AddToList } from './add-to-list/add-to-list';
import { READING_STATUS_LABELS, ReadingStatus } from '@app/core/models/library';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';
import { WorkCover } from '@app/shared/ui/work-cover/work-cover';

@Component({
  selector: 'app-work-detail-page',
  imports: [WorkCover, LoadError, RouterLink, DatePipe, HasPermissionDirective, WorkRatings, AddToList],
  templateUrl: './work-detail-page.html',
  styleUrl: './work-detail-page.scss'
})
export class WorkDetailPage {
  private readonly catalogApi = inject(CatalogApi);
  private readonly bookmarksApi = inject(BookmarksApi);
  private readonly libraryApi = inject(LibraryApi);
  private readonly readingApi = inject(ReadingApi);
  private readonly seo = inject(SeoService);
  protected readonly auth = inject(AuthStore);

  /** Bound from the `works/:workId` route. */
  readonly workId = input.required<string>();

  protected readonly work = this.catalogApi.workResource(this.workId);
  protected readonly chapters = this.catalogApi.chaptersResource(this.workId);

  /** Bookmark of the current user for this work (only fetched with BOOKMARK_READ). */
  private readonly canReadBookmark = computed(() => this.auth.can('BOOKMARK_READ'));
  private readonly bookmarkEntry = this.bookmarksApi.forWorkResource(this.workId, this.canReadBookmark);
  protected readonly bookmark = computed(() => (this.bookmarkEntry.hasValue() ? this.bookmarkEntry.value() : null) ?? null);

  protected readonly firstChapterId = computed(() => (this.chapters.hasValue() ? this.chapters.value()[0]?.id : null) ?? null);

  // Library and read markers (free with LIBRARY_USE).
  protected readonly statuses = Object.keys(READING_STATUS_LABELS) as ReadingStatus[];
  protected readonly statusLabels = READING_STATUS_LABELS;
  private readonly canUseLibrary = computed(() => this.auth.can('LIBRARY_USE'));
  private readonly libraryEntry = this.libraryApi.entryResource(this.workId, this.canUseLibrary);
  private readonly entry = computed(() => (this.libraryEntry.hasValue() ? this.libraryEntry.value() : null));
  /** This series' status in my library (`null` = not in it); updated locally after each change. */
  protected readonly libraryStatus = linkedSignal<ReadingStatus | null>(() => this.entry()?.status ?? null);
  /** New-chapter notifications for this series (US-10); updated locally after a change. */
  protected readonly libraryNotify = linkedSignal<boolean>(() => this.entry()?.newChapterNotifications ?? true);
  /** Library, notification and read-marker changes: one busy/error state. */
  protected readonly library = asyncAction('Could not update your library. Please try again.');

  private readonly progress = this.readingApi.progressResource(this.workId, this.canUseLibrary);
  private readonly finished = computed(() => new Set(this.progress.hasValue() ? (this.progress.value()?.finishedChapterIds ?? []) : []));
  /**
   * One row per chapter with its read marks, computed in a single pass: "Mark all previous as read" is offered only
   * on an unread chapter that has unread chapters before it (where it would change something).
   */
  protected readonly chapterRows = computed(() => {
    const finished = this.finished();
    const next = this.nextChapterId();
    const canMark = this.canUseLibrary() && this.progress.hasValue();
    let unreadBefore = false;
    return (this.chapters.hasValue() ? this.chapters.value() : []).map((chapter) => {
      const read = finished.has(chapter.id);
      const row = { chapter, read, next: chapter.id === next, canMarkPrevious: canMark && !read && unreadBefore };
      unreadBefore ||= !read;
      return row;
    });
  });
  protected readonly nextChapterId = computed(() => (this.progress.hasValue() ? (this.progress.value()?.nextChapterId ?? null) : null));
  /** "Continue" for a free reader who already finished chapters here. */
  protected readonly continueChapter = computed(() => {
    const next = this.nextChapterId();
    if (!next || this.finished().size === 0 || !this.chapters.hasValue()) return null;
    return this.chapters.value().find((chapter) => chapter.id === next) ?? null;
  });

  constructor() {
    effect(() => {
      if (this.work.error()) {
        this.seo.notFound('Work not found');
        return;
      }
      const w = this.work.hasValue() ? this.work.value() : undefined;
      if (w) {
        this.seo.update({
          title: `${w.title} (${w.type})`,
          description: w.synopsis?.slice(0, 160) || `Read ${w.title} on Readora.`,
          path: `/works/${w.id}`,
          image: w.coverImageUrl ?? undefined,
          type: 'article'
        });
      }
    });
  }

  protected async markPreviousAsRead(chapterId: string): Promise<void> {
    await this.library.run(async () => this.progress.set(await firstValueFrom(this.readingApi.markReadUpTo(chapterId))), {
      fallback: 'Could not update your read chapters. Please try again.'
    });
  }

  protected async addToLibrary(): Promise<void> {
    await this.saveLibrary(() => firstValueFrom(this.libraryApi.save(this.workId())).then((entry) => entry.status));
  }

  protected async changeLibraryStatus(event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement).value as ReadingStatus;
    await this.saveLibrary(() => firstValueFrom(this.libraryApi.save(this.workId(), status)).then((entry) => entry.status));
  }

  protected async toggleNotifications(event: Event): Promise<void> {
    const enabled = (event.target as HTMLInputElement).checked;
    await this.library.run(
      async () => {
        await firstValueFrom(this.libraryApi.setNotifications(this.workId(), enabled));
        this.libraryNotify.set(enabled);
      },
      { fallback: 'Could not update your notifications. Please try again.' }
    );
  }

  protected async removeFromLibrary(): Promise<void> {
    await this.saveLibrary(() => firstValueFrom(this.libraryApi.remove(this.workId())).then(() => null));
  }

  protected reload(): void {
    this.work.reload();
    this.chapters.reload();
  }

  private async saveLibrary(action: () => Promise<ReadingStatus | null>): Promise<void> {
    await this.library.run(async () => this.libraryStatus.set(await action()));
  }
}
