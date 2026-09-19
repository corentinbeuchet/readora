import { Component, booleanAttribute, computed, input } from '@angular/core';
import { ICON_PATHS, IconName } from './icon-paths';

/**
 * A line icon from the app's set (`icon-paths.ts`, generated from Lucide by `npm run icons`). It is decoration: hidden
 * from assistive technology, so the control around it carries the name (visible text or `aria-label`). It takes the
 * text colour and scales with the font size of its parent.
 *
 * ```html
 * <button type="button" class="btn btn-icon" aria-label="Notifications"><app-icon name="bell" /></button>
 * ```
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  host: { 'aria-hidden': 'true' }
})
export class Icon {
  readonly name = input.required<IconName>();
  /** Filled shape instead of an outline (a full star). */
  readonly filled = input(false, { transform: booleanAttribute });

  protected readonly paths = computed(() => ICON_PATHS[this.name()]);
}
