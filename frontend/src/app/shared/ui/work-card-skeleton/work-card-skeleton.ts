import { Component, computed, input } from '@angular/core';

/**
 * What a list of series looks like while it loads: screentone placeholders with the shape of `<app-work-card>`,
 * inside a `role="status"` whose text (projected, screen-reader only) says what is loading. Nothing animates.
 *
 * ```html
 * <app-work-card-skeleton variant="row" count="5" i18n="@@discovery.rankings.loading">Loading the ranking…</app-work-card-skeleton>
 * ```
 */
@Component({
  selector: 'app-work-card-skeleton',
  templateUrl: './work-card-skeleton.html',
  styleUrl: './work-card-skeleton.scss',
  host: { role: 'status' }
})
export class WorkCardSkeleton {
  /** `rail`: a single line of tiles that does not wrap (inside or in place of an `<app-rail>`). */
  readonly variant = input<'grid' | 'row' | 'rail'>('grid');
  readonly count = input(6, { transform: (value: number | string) => Number(value) });

  protected readonly placeholders = computed(() => Array.from({ length: this.count() }, (_, index) => index));
}
