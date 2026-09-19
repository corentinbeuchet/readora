import { Component, booleanAttribute, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WORK_STATUS_LABELS, WORK_TYPE_LABELS, WorkSummary } from '@app/core/models/catalog';
import { WorkCover } from '@app/shared/ui/work-cover/work-cover';

/**
 * How a series is shown everywhere (catalog, rails, rankings, lists, library, history, profiles): its cover, its
 * title as the one link of the card, and at most two badges. The link is stretched over the whole card, so the card
 * is one target named by the title alone; the cover is decoration next to it.
 *
 * - `variant="grid"`: a cover tile (catalog, rails); its width comes from the grid cell or rail item around it.
 * - `variant="row"`: cover on the left, text and projected content on the right (rankings, library, history…).
 *
 * Extra lines go in an element marked `cardMeta`; buttons and links of the row in one marked `cardActions` (they stay
 * clickable above the stretched link).
 *
 * ```html
 * <li><app-work-card [work]="entry.work" variant="row" [rank]="entry.rank" /></li>
 * ```
 */
@Component({
  selector: 'app-work-card',
  imports: [RouterLink, WorkCover],
  templateUrl: './work-card.html',
  styleUrl: './work-card.scss'
})
export class WorkCard {
  readonly work = input.required<WorkSummary>();
  readonly variant = input<'grid' | 'row'>('grid');
  /** Position in a ranking: drawn as a large numeral. */
  readonly rank = input<number>();
  /** Chapters published since the reader last read the series: shown as a "new" badge instead of the status. */
  readonly newChapters = input(0);
  /** The first cover of a page (its LCP image). */
  readonly priority = input(false, { transform: booleanAttribute });

  protected readonly typeLabel = computed(() => WORK_TYPE_LABELS[this.work().type]);
  protected readonly statusLabel = computed(() => WORK_STATUS_LABELS[this.work().status]);
}
