import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DiscoveryApi } from '@app/core/api/discovery-api';
import { RankingPeriod } from '@app/core/models/discovery';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';
import { DecimalPipe, I18nPluralPipe } from '@angular/common';

const PERIODS: { key: RankingPeriod; label: string }[] = [
  { key: 'TODAY', label: 'Today' },
  { key: 'WEEK', label: 'This week' },
  { key: 'MONTH', label: 'This month' },
  { key: 'ALL', label: 'All time' }
];

/** Rankings (US-08): popular by period, and top rated. */
@Component({
  selector: 'app-rankings-page',
  imports: [I18nPluralPipe, DecimalPipe, LoadError, RouterLink],
  templateUrl: './rankings-page.html',
  styleUrl: './rankings-page.scss'
})
export class RankingsPage {
  protected readonly ratingsPlural = { '=1': '1 rating', other: '# ratings' };
  private readonly discovery = inject(DiscoveryApi);
  protected readonly periods = PERIODS;

  /** `?list=top-rated` and `?period=` query parameters. */
  readonly list = input<string>();
  readonly period = input<string>();

  protected readonly topRatedSelected = computed(() => this.list() === 'top-rated');
  protected readonly selectedPeriod = computed<RankingPeriod>(() => PERIODS.find((p) => p.key === this.period())?.key ?? 'WEEK');
  /** Only the visible ranking is fetched. */
  private readonly popular = this.discovery.popularResource(this.selectedPeriod, computed(() => !this.topRatedSelected()));
  private readonly topRated = this.discovery.topRatedResource(this.topRatedSelected);
  protected readonly ranking = computed(() => (this.topRatedSelected() ? this.topRated : this.popular));

  constructor() {
    inject(SeoService).update({
      title: 'Rankings — popular and top rated',
      description: 'The most read and best rated manga, manhwa and comics on Readora.',
      path: '/rankings'
    });
  }
}
