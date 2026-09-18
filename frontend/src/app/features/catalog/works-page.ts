import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { CatalogQuery, Demographic, WorkStatus, WorkType } from '@app/core/models/readora.models';
import { SeoService } from '@app/core/seo/seo.service';
import { FALLBACK_COVER_IMAGE, onImageError } from '@app/core/utils/image-utils';

const PAGE_SIZE = 24;

export const WORK_TYPES: readonly WorkType[] = ['MANGA', 'MANHWA', 'MANHUA', 'COMIC'];
export const WORK_STATUSES: readonly WorkStatus[] = ['ONGOING', 'COMPLETED', 'HIATUS'];
export const DEMOGRAPHICS: readonly Demographic[] = ['SHOUNEN', 'SHOUJO', 'SEINEN', 'JOSEI'];

export type GenreState = 'wanted' | 'excluded' | 'off';

const GENRE_STATE_LABEL: Record<GenreState, string> = { wanted: 'wanted', excluded: 'excluded', off: 'not filtered' };

/** A query parameter bound by the router: absent, once, or repeated. */
type ParamValue = string | string[] | undefined;

function asList(value: ParamValue): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

/**
 * Catalog (US-04). The URL is the single source of truth for the filters (`?q=&genre=&excludeGenre=&type=&status=
 * &demographic=&page=`), so results are shareable and the back button undoes a filter change.
 */
@Component({
  selector: 'app-works-page',
  imports: [RouterLink, NgOptimizedImage, HasPermissionDirective],
  templateUrl: './works-page.html',
  styleUrl: './works-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorksPage {
  private readonly catalogApi = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  protected readonly fallbackCover = FALLBACK_COVER_IMAGE;
  protected readonly handleCoverError = onImageError;
  protected readonly workTypes = WORK_TYPES;
  protected readonly workStatuses = WORK_STATUSES;
  protected readonly demographics = DEMOGRAPHICS;

  // Query parameters (withComponentInputBinding).
  readonly q = input<string>();
  readonly genre = input<ParamValue>();
  readonly excludeGenre = input<ParamValue>();
  readonly type = input<string>();
  readonly status = input<string>();
  readonly demographic = input<string>();
  readonly page = input<string>();

  protected readonly query = computed<CatalogQuery>(() => ({
    text: this.q()?.trim() || undefined,
    genres: asList(this.genre()),
    excludedGenres: asList(this.excludeGenre()),
    type: oneOf(WORK_TYPES, this.type()),
    status: oneOf(WORK_STATUSES, this.status()),
    demographic: oneOf(DEMOGRAPHICS, this.demographic()),
    page: Math.max(0, Math.trunc(Number(this.page())) || 0),
    size: PAGE_SIZE
  }));
  protected readonly works = this.catalogApi.worksResource(this.query);
  protected readonly genres = this.catalogApi.genresResource();

  protected readonly hasFilters = computed(() => {
    const query = this.query();
    return !!(query.text || query.genres?.length || query.excludedGenres?.length || query.type || query.status || query.demographic);
  });
  protected readonly hasPrevious = computed(() => this.query().page > 0);
  protected readonly hasNext = computed(() => this.query().page + 1 < (this.works.hasValue() ? this.works.value().totalPages : 0));

  constructor() {
    this.seo.update({
      title: 'Catalog — manga, manhwa & comics',
      description: 'Browse every manga, manhwa, manhua and comic published on Readora by scanlation teams.',
      path: '/works'
    });
  }

  protected genreState(genre: string): GenreState {
    const query = this.query();
    if (query.genres?.includes(genre)) return 'wanted';
    if (query.excludedGenres?.includes(genre)) return 'excluded';
    return 'off';
  }

  protected genreLabel(genre: string): string {
    return `${genre}: ${GENRE_STATE_LABEL[this.genreState(genre)]}`;
  }

  /** Off → wanted → excluded → off. */
  protected cycleGenre(genre: string): void {
    const state = this.genreState(genre);
    const wanted = (this.query().genres ?? []).filter((g) => g !== genre);
    const excluded = (this.query().excludedGenres ?? []).filter((g) => g !== genre);
    if (state === 'off') wanted.push(genre);
    if (state === 'wanted') excluded.push(genre);
    this.applyFilters({ genre: wanted, excludeGenre: excluded });
  }

  protected setFacet(name: 'type' | 'status' | 'demographic', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.applyFilters({ [name]: value || null });
  }

  protected clearFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected clearText(): void {
    this.applyFilters({ q: null });
  }

  protected previous(): void {
    if (this.hasPrevious()) {
      this.goToPage(this.query().page - 1);
    }
  }

  protected next(): void {
    if (this.hasNext()) {
      this.goToPage(this.query().page + 1);
    }
  }

  protected reload(): void {
    this.works.reload();
  }

  /** Any filter change goes back to the first page. Empty lists and `null` remove the parameter. */
  private applyFilters(changes: Record<string, string | string[] | null>): void {
    const queryParams: Record<string, string | string[] | null> = { page: null };
    for (const [key, value] of Object.entries(changes)) {
      queryParams[key] = Array.isArray(value) && value.length === 0 ? null : value;
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  private goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 0 ? page : null },
      queryParamsHandling: 'merge'
    });
  }
}
