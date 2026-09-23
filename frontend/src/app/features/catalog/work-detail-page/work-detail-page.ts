import { Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { firstValueFrom } from 'rxjs';
import { asyncAction } from '@app/core/utils/async-action';
import { BookmarksApi } from '@app/core/api/bookmarks-api';
import { LibraryApi } from '@app/core/api/library-api';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { ChapterList } from './chapter-list/chapter-list';
import { WorkFactList } from './work-fact-list/work-fact-list';
import { WorkRatings } from './work-ratings/work-ratings';
import { WorkTeams } from './work-teams/work-teams';
import { AddToList } from './add-to-list/add-to-list';
import { groupByNumber, pickVersion, teamsOf } from '@app/core/models/chapter';
import { READING_STATUS_LABELS, ReadingStatus } from '@app/core/models/library';
import { PreferredTeamStore } from '@app/core/reading/preferred-team-store';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';
import { WorkCover } from '@app/shared/ui/work-cover/work-cover';
import { WORK_STATUS_LABELS, WORK_TYPE_LABELS } from '@app/core/models/catalog';

@Component({
  selector: 'app-work-detail-page',
  imports: [WorkCover, LoadError, RouterLink, HasPermissionDirective, WorkRatings, AddToList, ChapterList, WorkTeams, WorkFactList],
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
  private readonly preferredTeam = inject(PreferredTeamStore);

  /** Bound from the `works/:workId` route. */
  readonly workId = input.required<string>();
  /** `?team=` and `?order=`: the chapter list's filter and sort. */
  readonly team = input<string>();
  readonly order = input<string>();

  protected readonly work = this.catalogApi.workResource(this.workId);
  protected readonly chapters = this.catalogApi.chaptersResource(this.workId);

  /** Bookmark of the current user for this work (only fetched with BOOKMARK_READ). */
  private readonly canReadBookmark = computed(() => this.auth.can('BOOKMARK_READ'));
  private readonly bookmarkEntry = this.bookmarksApi.forWorkResource(this.workId, this.canReadBookmark);
  /**
   * The saved page to resume from, only while its chapter is published and not finished yet: a bookmark in a chapter
   * I finished (or one that is gone or unpublished) would hide "Continue with chapter N" or "Read again".
   */
  protected readonly resumeBookmark = computed(() => {
    const bookmark = this.bookmarkEntry.hasValue() ? this.bookmarkEntry.value() : null;
    const chapter = bookmark?.lastReadChapterId ? this.published().find((c) => c.id === bookmark.lastReadChapterId) : undefined;
    if (!bookmark || !chapter || this.progress()?.finishedChapterNumbers.includes(chapter.chapterNumber)) return null;
    return { chapterId: chapter.id, page: bookmark.lastReadPageIndex };
  });

  // Library and read markers (free with LIBRARY_USE).
  protected readonly statuses = Object.keys(READING_STATUS_LABELS) as ReadingStatus[];
  protected readonly statusLabels = READING_STATUS_LABELS;
  protected readonly typeLabels = WORK_TYPE_LABELS;
  protected readonly workStatusLabels = WORK_STATUS_LABELS;
  protected readonly canUseLibrary = computed(() => this.auth.can('LIBRARY_USE'));
  private readonly libraryEntry = this.libraryApi.entryResource(this.workId, this.canUseLibrary);
  private readonly entry = computed(() => (this.libraryEntry.hasValue() ? this.libraryEntry.value() : null));
  /** This series' status in my library (`null` = not in it); updated locally after each change. */
  protected readonly libraryStatus = linkedSignal<ReadingStatus | null>(() => this.entry()?.status ?? null);
  /** New-chapter notifications for this series (US-10); updated locally after a change. */
  protected readonly libraryNotify = linkedSignal<boolean>(() => this.entry()?.newChapterNotifications ?? true);
  /** Library, notification and read-marker changes: one busy/error state. */
  protected readonly library = asyncAction($localize`:@@catalog.work.libraryError:Could not update your library. Please try again.`);

  private readonly progressEntry = this.readingApi.progressResource(this.workId, this.canUseLibrary);
  /** My progress in the series: read marks and "Next up" follow the chapter number, whichever team's version I read. */
  protected readonly progress = computed(() => (this.progressEntry.hasValue() ? (this.progressEntry.value() ?? null) : null));
  protected readonly published = computed(() => (this.chapters.hasValue() ? this.chapters.value() : []));
  protected readonly teams = computed(() => teamsOf(this.published()));
  private readonly groups = computed(() => groupByNumber(this.published()));
  private readonly myTeam = computed(() => this.preferredTeam.teamFor(this.workId()));

  /** "Start reading": the first chapter, in my team's version when it has one. */
  protected readonly firstChapterId = computed(() => pickVersion(this.groups()[0]?.versions ?? [], this.myTeam())?.id ?? null);
  /** "Continue" for a free reader who already finished chapters here: my team's version, else the server's choice. */
  protected readonly continueChapter = computed(() => {
    const progress = this.progress();
    if (!progress?.nextChapterNumber || progress.finishedChapterNumbers.length === 0) return null;
    const versions = this.groups().find((group) => group.chapterNumber === progress.nextChapterNumber)?.versions ?? [];
    const mine = this.myTeam();
    return (mine ? pickVersion(versions, mine) : versions.find((version) => version.id === progress.nextChapterId)) ?? versions[0] ?? null;
  });

  /** I finished chapters here and none is left to read: "Read again" instead of "Start reading". */
  protected readonly upToDate = computed(() => {
    const progress = this.progress();
    return !!progress && progress.finishedChapterNumbers.length > 0 && !progress.nextChapterNumber;
  });

  constructor() {
    effect(() => {
      if (this.work.error()) {
        this.seo.notFound($localize`:@@catalog.work.seoNotFound:Work not found`);
        return;
      }
      const w = this.work.hasValue() ? this.work.value() : undefined;
      if (w) {
        this.seo.update({
          title: $localize`:@@catalog.work.seoTitle:${w.title}:title: (${WORK_TYPE_LABELS[w.type]}:type:)`,
          description: w.synopsis?.slice(0, 160) || $localize`:@@catalog.work.seoDescription:Read ${w.title}:title: on Readora.`,
          path: `/works/${w.id}`,
          image: w.coverImageUrl ?? undefined,
          type: 'article'
        });
      }
    });
  }

  protected async markPreviousAsRead(chapterId: string): Promise<void> {
    await this.library.run(async () => this.progressEntry.set(await firstValueFrom(this.readingApi.markReadUpTo(chapterId))), {
      fallback: $localize`:@@catalog.work.readMarkError:Could not update your read chapters. Please try again.`
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
      { fallback: $localize`:@@catalog.work.notifyError:Could not update your notifications. Please try again.` }
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
