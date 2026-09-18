import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { BookmarksApi } from '@app/core/api/bookmarks-api';
import { LibraryApi } from '@app/core/api/library-api';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { READING_STATUS_LABELS, ReadingStatus } from '@app/core/models/readora.models';
import { SeoService } from '@app/core/seo/seo.service';
import { FALLBACK_COVER_IMAGE, onImageError } from '@app/core/utils/image-utils';

@Component({
  selector: 'app-work-detail-page',
  imports: [RouterLink, DatePipe, NgOptimizedImage, HasPermissionDirective],
  templateUrl: './work-detail-page.html',
  styleUrl: './work-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkDetailPage {
  private readonly catalogApi = inject(CatalogApi);
  private readonly bookmarksApi = inject(BookmarksApi);
  private readonly libraryApi = inject(LibraryApi);
  private readonly readingApi = inject(ReadingApi);
  private readonly seo = inject(SeoService);
  protected readonly auth = inject(AuthStore);
  protected readonly fallbackCover = FALLBACK_COVER_IMAGE;
  protected readonly handleCoverError = onImageError;

  /** Bound from the `works/:workId` route. */
  readonly workId = input.required<string>();

  protected readonly work = this.catalogApi.workResource(this.workId);
  protected readonly chapters = this.catalogApi.chaptersResource(this.workId);

  /** Bookmark of the current user for this work (only fetched with BOOKMARK_READ). */
  private readonly canReadBookmark = computed(() => this.auth.can('BOOKMARK_READ'));
  protected readonly bookmarks = this.bookmarksApi.listResource(this.canReadBookmark);
  protected readonly bookmark = computed(() => (this.bookmarks.hasValue() ? this.bookmarks.value() : []).find((b) => b.workId === this.workId()) ?? null);

  protected readonly firstChapterId = computed(() => (this.chapters.hasValue() ? this.chapters.value()[0]?.id : null) ?? null);

  // Library and read markers (free with LIBRARY_USE).
  protected readonly statuses = Object.keys(READING_STATUS_LABELS) as ReadingStatus[];
  protected readonly statusLabels = READING_STATUS_LABELS;
  private readonly canUseLibrary = computed(() => this.auth.can('LIBRARY_USE'));
  private readonly libraryItems = this.libraryApi.listResource(signal(undefined), this.canUseLibrary);
  /** This series' status in my library (`null` = not in it); updated locally after each change. */
  protected readonly libraryStatus = linkedSignal<ReadingStatus | null>(() => {
    const items = this.libraryItems.hasValue() ? this.libraryItems.value() : [];
    return items.find((item) => item.work.id === this.workId())?.status ?? null;
  });
  protected readonly librarySaving = signal(false);
  protected readonly libraryError = signal<string | null>(null);

  private readonly progress = this.readingApi.progressResource(this.workId, this.canUseLibrary);
  private readonly finished = computed(() => new Set(this.progress.hasValue() ? (this.progress.value()?.finishedChapterIds ?? []) : []));
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
          image: w.coverImageUrl,
          type: 'article'
        });
      }
    });
  }

  protected isFinished(chapterId: string): boolean {
    return this.finished().has(chapterId);
  }

  protected async addToLibrary(): Promise<void> {
    await this.saveLibrary(() => firstValueFrom(this.libraryApi.save(this.workId())).then((entry) => entry.status));
  }

  protected async changeLibraryStatus(event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement).value as ReadingStatus;
    await this.saveLibrary(() => firstValueFrom(this.libraryApi.save(this.workId(), status)).then((entry) => entry.status));
  }

  protected async removeFromLibrary(): Promise<void> {
    await this.saveLibrary(() => firstValueFrom(this.libraryApi.remove(this.workId())).then(() => null));
  }

  protected reload(): void {
    this.work.reload();
    this.chapters.reload();
  }

  private async saveLibrary(action: () => Promise<ReadingStatus | null>): Promise<void> {
    this.librarySaving.set(true);
    this.libraryError.set(null);
    try {
      this.libraryStatus.set(await action());
    } catch (error) {
      this.libraryError.set(apiErrorMessage(error, 'Could not update your library. Please try again.'));
    } finally {
      this.librarySaving.set(false);
    }
  }
}
