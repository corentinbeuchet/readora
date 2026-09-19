import { Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FALLBACK_PAGE_IMAGE, onImageError } from '@app/core/utils/image-utils';
import { ReaderPreferencesStore } from '@app/features/reader/reader-page/reader-preferences-store';
import { ReaderState } from '@app/features/reader/reader-page/reader-state';

/** Minimum horizontal travel (px) for a touch swipe to turn the page. */
const SWIPE_THRESHOLD_PX = 50;

/**
 * Paged mode: one page (or a two-page spread) at a time, turned with the buttons, a swipe or a click on the left or
 * right third; the next pages preload so turning is instant.
 */
@Component({
  selector: 'app-paged-flow',
  imports: [NgOptimizedImage],
  templateUrl: './paged-flow.html',
  styleUrl: './paged-flow.scss',
  host: {
    '[class.fit-width]': "prefs.fit() === 'WIDTH'",
    '[class.fit-height]': "prefs.fit() === 'HEIGHT'",
    '[class.fit-original]': "prefs.fit() === 'ORIGINAL'"
  }
})
export class PagedFlow {
  protected readonly state = inject(ReaderState);
  protected readonly prefs = inject(ReaderPreferencesStore);
  protected readonly fallbackPage = FALLBACK_PAGE_IMAGE;
  protected readonly handlePageError = onImageError;

  private swipeStart: { x: number; y: number } | null = null;
  /** A swipe also ends with a click on a turn zone: that click must not turn a second page. */
  private swiped = false;

  /** Click zones: the side the next page is on depends on the reading direction. */
  protected turnFromSide(side: 'left' | 'right'): void {
    if (this.swiped) {
      this.swiped = false;
      return;
    }
    this.turn((side === 'right') !== (this.state.direction() === 'RTL'));
  }

  protected onPointerDown(event: PointerEvent): void {
    this.swipeStart = { x: event.clientX, y: event.clientY };
    this.swiped = false;
  }

  /** Swiping left brings the page on the right (next page left-to-right, previous page right-to-left). */
  protected onPointerUp(event: PointerEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) {
      return;
    }
    this.swiped = true;
    this.turn((dx < 0) !== (this.state.direction() === 'RTL'));
  }

  private turn(forward: boolean): void {
    if (forward) {
      this.state.nextPage();
    } else {
      this.state.previousPage();
    }
  }
}
