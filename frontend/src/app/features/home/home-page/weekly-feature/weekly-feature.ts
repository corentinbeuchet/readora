import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionHeader } from '@app/shared/ui/section-header/section-header';
import { WORK_STATUS_LABELS, WORK_TYPE_LABELS } from '@app/core/models/catalog';
import { RankedWork } from '@app/core/models/discovery';
import { LoadError } from '@app/shared/ui/load-error';
import { WorkCard } from '@app/shared/ui/work-card/work-card';
import { WorkCover } from '@app/shared/ui/work-cover/work-cover';

/**
 * The top of the home page (US-14): the most read series of the week as a magazine-cover feature, the next four as a
 * numbered list (a real ranking, so the numbers mean something), and a link to the full ranking. It never rotates.
 * While the ranking loads it keeps its final size with screentone placeholders; with no ranking yet (a new site) it
 * sends the visitor to the catalog.
 */
@Component({
  selector: 'app-weekly-feature',
  imports: [RouterLink, WorkCover, WorkCard, LoadError, SectionHeader],
  templateUrl: './weekly-feature.html',
  styleUrl: './weekly-feature.scss'
})
export class WeeklyFeature {
  readonly ranking = input.required<RankedWork[]>();
  readonly pending = input.required<boolean>();
  readonly error = input<unknown>();
  readonly retry = output();

  protected readonly first = computed(() => this.ranking()[0]);
  protected readonly others = computed(() => this.ranking().slice(1, 5));
  /** A few genres of the featured series, each a way into the catalog. */
  protected readonly genres = computed(() => this.first()?.work.genres.slice(0, 4) ?? []);
  protected readonly typeLabels = WORK_TYPE_LABELS;
  protected readonly statusLabels = WORK_STATUS_LABELS;
}
