import { DecimalPipe } from '@angular/common';
import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { DiscoveryApi } from '@app/core/api/discovery-api';
import { ListsApi } from '@app/core/api/lists-api';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { RankingPeriod } from '@app/core/models/discovery';
import { SeoService } from '@app/core/seo/seo.service';
import { Icon } from '@app/shared/ui/icon/icon';
import { ListCard } from '@app/shared/ui/list-card/list-card';
import { LoadError } from '@app/shared/ui/load-error';
import { Rail } from '@app/shared/ui/rail/rail';
import { SectionHeader } from '@app/shared/ui/section-header/section-header';
import { TimeAgoPipe } from '@app/shared/ui/time-ago.pipe';
import { WorkCard } from '@app/shared/ui/work-card/work-card';
import { WorkCardSkeleton } from '@app/shared/ui/work-card-skeleton/work-card-skeleton';
import { ContinueReading } from './continue-reading/continue-reading';
import { SignupPrompt } from './signup-prompt/signup-prompt';
import { WeeklyFeature } from './weekly-feature/weekly-feature';

/** Tiles per rail: enough to browse, few enough to Tab through. */
const RAIL_SIZE = 10;

/**
 * The home page (US-14). Only its frame is prerendered: headings, the genre shortcuts and placeholders. Everything
 * that changes by the hour (this week's ranking, latest chapters, top rated, lists) and everything personal loads in
 * the browser, once `live` is set after the first render: a prerendered copy would be frozen until the next deploy,
 * and the transfer cache only hands over catalog reads (`core/api/transfer-cache.ts`).
 *
 * Order: what the reader was doing (continue reading, new chapters of their library), then what everyone reads.
 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, DecimalPipe, TimeAgoPipe, Icon, Rail, SectionHeader, WorkCard, WorkCardSkeleton, ListCard, LoadError, WeeklyFeature, ContinueReading, SignupPrompt],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage {
  protected readonly auth = inject(AuthStore);
  private readonly discoveryApi = inject(DiscoveryApi);

  /** False on the server and during hydration, so both render the same frame; true once the page is in a browser. */
  private readonly live = signal(false);
  /** Personal sections need a signed-in reader (history and library are `LIBRARY_USE`). */
  private readonly personal = computed(() => this.live() && this.auth.can('LIBRARY_USE'));

  protected readonly genres = inject(CatalogApi).genresResource();
  protected readonly weekly = this.discoveryApi.popularResource(signal<RankingPeriod>('WEEK'), this.live);
  protected readonly latest = this.discoveryApi.latestResource(signal(false), signal(0), this.live);
  protected readonly topRated = this.discoveryApi.topRatedResource(this.live);
  protected readonly lists = inject(ListsApi).topResource(this.live);
  protected readonly history = inject(ReadingApi).historyResource(this.personal);
  protected readonly mine = this.discoveryApi.latestResource(signal(true), signal(0), this.personal);

  /** Not loaded yet: before the page is live, or while the request runs. */
  protected readonly weeklyPending = computed(() => !this.live() || this.weekly.isLoading());
  protected readonly latestPending = computed(() => !this.live() || this.latest.isLoading());
  protected readonly topRatedPending = computed(() => !this.live() || this.topRated.isLoading());
  protected readonly listsPending = computed(() => !this.live() || this.lists.isLoading());

  protected readonly weeklyRanking = computed(() => (this.weekly.hasValue() ? this.weekly.value() : []));
  protected readonly latestReleases = computed(() => (this.latest.hasValue() ? this.latest.value().slice(0, RAIL_SIZE) : []));
  protected readonly topRatedSeries = computed(() => (this.topRated.hasValue() ? this.topRated.value().slice(0, RAIL_SIZE) : []));
  protected readonly topLists = computed(() => (this.lists.hasValue() ? this.lists.value().slice(0, RAIL_SIZE) : []));
  protected readonly readingHistory = computed(() => (this.history.hasValue() ? this.history.value() : []));
  /** Chapters of the reader's library they have not finished yet. */
  protected readonly unreadReleases = computed(() => (this.mine.hasValue() ? this.mine.value().filter((release) => !release.read).slice(0, RAIL_SIZE) : []));
  /** Keeps the room of "Continue reading" until the history has answered (see home-page.scss). */
  protected readonly historyPending = computed(() => !this.live() || this.history.isLoading());

  constructor() {
    inject(SeoService).update({
      title: $localize`:@@home.page.seoTitle:Read manga, manhwa and comics online`,
      description: $localize`:@@home.page.seoDescription:This week's most read series, the latest chapters and reading lists: manga, manhwa, manhua and comics translated by scanlation teams, free to read on Readora.`,
      path: '/'
    });
    afterNextRender(() => this.live.set(true));
  }
}
