import { DOCUMENT, DestroyRef, Service, effect, inject, signal, untracked } from '@angular/core';
import { AutoScrollSpeed, ReaderPreferencesStore } from './reader-preferences-store';
import { ReaderState } from './reader-state';

/** Auto-scroll speeds in pixels per second. */
export const AUTO_SCROLL_PX_PER_SECOND: Record<AutoScrollSpeed, number> = { SLOW: 30, MEDIUM: 60, FAST: 120 };
/** Any of these from the reader stops auto-scroll. */
const STOP_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/**
 * Vertical-mode auto-scroll (US-07), provided by the reader page: scrolls the page on its own at the chosen speed
 * until the end, or until the reader scrolls, touches, clicks or presses a key.
 */
@Service({ autoProvided: false })
export class AutoScroller {
  private readonly document = inject(DOCUMENT);
  private readonly prefs = inject(ReaderPreferencesStore);
  private readonly state = inject(ReaderState);

  private readonly _active = signal(false);
  readonly active = this._active.asReadonly();
  private stop: (() => void) | null = null;

  constructor() {
    // A vertical-mode feature: stops when the reader switches to paged mode (stopping the animation is the side effect).
    effect(() => {
      if (this.state.viewMode() !== 'VERTICAL') {
        untracked(() => this.toggle(false));
      }
    });
    inject(DestroyRef).onDestroy(() => this.stop?.());
  }

  toggle(on = !this._active()): void {
    this.stop?.();
    this.stop = null;
    const win = this.document.defaultView;
    if (!on || !win?.requestAnimationFrame) {
      this._active.set(false);
      return;
    }
    let frame = 0;
    let last: number | null = null;
    let carry = 0;
    const step = (now: number) => {
      const elapsed = last === null ? 0 : now - last;
      last = now;
      carry += (AUTO_SCROLL_PX_PER_SECOND[this.prefs.autoScrollSpeed()] * elapsed) / 1000;
      const pixels = Math.floor(carry);
      carry -= pixels;
      if (pixels > 0) {
        win.scrollBy(0, pixels);
      }
      const atBottom = win.innerHeight + win.scrollY >= this.document.documentElement.scrollHeight - 1;
      if (atBottom && elapsed > 0) {
        this.toggle(false);
        return;
      }
      frame = win.requestAnimationFrame(step);
    };
    // The toggle button handles its own clicks (otherwise pressing it to stop would stop, then restart).
    const stopOnInput = (event: Event) => {
      if (!(event.target as Element | null)?.closest?.('[data-auto-scroll-toggle]')) {
        this.toggle(false);
      }
    };
    frame = win.requestAnimationFrame(step);
    for (const type of STOP_EVENTS) {
      this.document.addEventListener(type, stopOnInput, { passive: true });
    }
    this.stop = () => {
      win.cancelAnimationFrame(frame);
      for (const type of STOP_EVENTS) {
        this.document.removeEventListener(type, stopOnInput);
      }
    };
    this._active.set(true);
  }
}
