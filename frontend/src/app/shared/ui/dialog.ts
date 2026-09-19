import { Component, input, output } from '@angular/core';
import { FocusTrapDirective } from '@app/core/a11y/focus-trap.directive';

/**
 * Modal dialog shell: backdrop, `role="dialog"` + `aria-modal`, focus trap with initial focus and focus return,
 * Escape emits `closed`. The content (usually a form with a heading whose id is `labelledBy`) is projected:
 *
 * ```html
 * <app-dialog labelledBy="report-title" (closed)="close()">
 *   <form class="form" (submit)="send($event)">
 *     <h2 id="report-title">Report page 3</h2> …
 *     <div class="dialog-actions">…</div>
 *   </form>
 * </app-dialog>
 * ```
 */
@Component({
  selector: 'app-dialog',
  imports: [FocusTrapDirective],
  templateUrl: './dialog.html',
  styleUrl: './dialog.scss'
})
export class Dialog {
  /** Id of the dialog's heading. */
  readonly labelledBy = input.required<string>();
  /** Preferred width (never wider than the screen). */
  readonly width = input('440px');
  readonly closed = output();
}
