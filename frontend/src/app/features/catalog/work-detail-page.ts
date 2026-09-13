import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { BookmarksApi } from '@app/core/api/bookmarks-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { FALLBACK_COVER_IMAGE, onImageError } from '@app/core/utils/image-utils';

@Component({
  selector: 'app-work-detail-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './work-detail-page.html',
  styleUrl: './work-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkDetailPage {
  private readonly catalogApi = inject(CatalogApi);
  private readonly bookmarksApi = inject(BookmarksApi);
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
  protected readonly bookmark = computed(() => this.bookmarks.value()?.find((b) => b.workId === this.workId()) ?? null);

  protected readonly firstChapterId = computed(() => this.chapters.value()?.[0]?.id ?? null);

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

  protected reload(): void {
    this.work.reload();
    this.chapters.reload();
  }
}
