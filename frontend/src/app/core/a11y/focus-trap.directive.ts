import { DOCUMENT, DestroyRef, Directive, ElementRef, afterNextRender, inject, output } from '@angular/core';

// `tabindex="-1"` takes a control out of the Tab order (e.g. the page uploader's hidden file input, opened by its drop zone).
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]'
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(',');

/**
 * Modal dialog focus management, for an element rendered while the dialog is open:
 * - initial focus on the first focusable element (after render, browser only),
 * - Tab / Shift+Tab wrap inside the element (focus trap),
 * - Escape emits `escaped` (the host closes the dialog),
 * - on destroy, focus returns to the element that was focused when the dialog opened.
 */
@Directive({
  selector: '[appFocusTrap]',
  host: { '(keydown)': 'onKeydown($event)' }
})
export class FocusTrapDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  readonly escaped = output<void>();

  /** Captured when the dialog opens (the trigger button). */
  private readonly returnFocusTo = this.document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => this.focusables()[0]?.focus());
    inject(DestroyRef).onDestroy(() => {
      if (this.returnFocusTo?.isConnected) {
        this.returnFocusTo.focus();
      }
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.escaped.emit();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const items = this.focusables();
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || !this.host.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE));
  }
}
