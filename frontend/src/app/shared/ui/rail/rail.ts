import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { Icon } from '@app/shared/ui/icon/icon';
import { SectionHeader } from '@app/shared/ui/section-header/section-header';

let nextRailId = 0;

/**
 * A section whose items scroll sideways: a heading with "See all", then one line of tiles with the next one peeking
 * in. It is a plain list of links (keyboard users Tab through them and the browser scrolls them into view), not an
 * ARIA carousel: nothing rotates, nothing advances on its own. The arrow buttons page through it with a mouse.
 * Project `<li class="rail-item">` elements (global class in styles.scss).
 *
 * ```html
 * <app-rail heading="Top rated" i18n-heading="@@home.topRated" seeAll="/rankings">
 *   @for (entry of topRated.value(); track entry.work.id) {
 *     <li class="rail-item"><app-work-card [work]="entry.work" /></li>
 *   }
 * </app-rail>
 * ```
 */
@Component({
  selector: 'app-rail',
  imports: [SectionHeader, Icon],
  templateUrl: './rail.html',
  styleUrl: './rail.scss'
})
export class Rail {
  readonly heading = input.required<string>();
  readonly seeAll = input<string>();
  readonly seeAllParams = input<Record<string, string>>();

  protected readonly headingId = `rail-${nextRailId++}`;
  /** The arrows name the section they scroll: a page has several rails. */
  protected readonly backLabel = computed(() => $localize`:@@rail.back:Scroll back: ${this.heading()}:heading:`);
  protected readonly forwardLabel = computed(() => $localize`:@@rail.forward:Scroll forward: ${this.heading()}:heading:`);
  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const track = this.track().nativeElement;
      const update = () => this.updateEnds();
      track.addEventListener('scroll', update, { passive: true });
      destroyRef.onDestroy(() => track.removeEventListener('scroll', update));
      this.updateEnds();
    });
  }

  /** One "page" forward or back: most of the visible width, so the peeking tile becomes the first one. */
  protected page(direction: 1 | -1): void {
    const track = this.track().nativeElement;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: 'smooth' });
  }

  private updateEnds(): void {
    const track = this.track().nativeElement;
    this.atStart.set(track.scrollLeft <= 1);
    this.atEnd.set(track.scrollLeft + track.clientWidth >= track.scrollWidth - 1);
  }
}
