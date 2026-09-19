import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DiscoveryApi } from '@app/core/api/discovery-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';
import { EmptyState } from '@app/shared/ui/empty-state/empty-state';
import { WorkCard } from '@app/shared/ui/work-card/work-card';
import { WorkCardSkeleton } from '@app/shared/ui/work-card-skeleton/work-card-skeleton';
import { TimeAgoPipe } from '@app/shared/ui/time-ago.pipe';

/** Latest updates (US-08): newest chapters, optionally only my library and followed teams. */
@Component({
  selector: 'app-updates-page',
  imports: [TimeAgoPipe, WorkCard, WorkCardSkeleton, EmptyState, LoadError, RouterLink],
  templateUrl: './updates-page.html',
  styleUrl: './updates-page.scss'
})
export class UpdatesPage {
  private readonly discovery = inject(DiscoveryApi);
  protected readonly auth = inject(AuthStore);

  /** `?feed=mine` and `?page=` query parameters. */
  readonly feed = input<string>();
  readonly page = input<string>();

  protected readonly canFilter = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly mine = computed(() => this.feed() === 'mine' && this.canFilter());
  protected readonly pageIndex = computed(() => Math.max(0, Math.trunc(Number(this.page())) || 0));
  protected readonly releases = this.discovery.latestResource(this.mine, this.pageIndex);
  /** Accessible name of each row's "Read now" link, by chapter id. */
  protected readonly readNowLabels = computed(
    () =>
      new Map(
        (this.releases.hasValue() ? this.releases.value() : []).map((release) => [
          release.chapterId,
          $localize`:@@discovery.updates.readNow.label:Read now: ${release.work.title}:title:, chapter ${release.chapterNumber}:chapter:`
        ])
      )
  );

  constructor() {
    inject(SeoService).update({
      title: $localize`:@@discovery.updates.seoTitle:Latest updates`,
      description: $localize`:@@discovery.updates.seoDescription:The newest manga, manhwa and comic chapters on Readora.`,
      path: '/updates'
    });
  }
}
