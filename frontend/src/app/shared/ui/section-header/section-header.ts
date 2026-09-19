import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Heading of a section of a page, with an optional "See all" link to the full page. Give it a `headingId` when the
 * section is labelled by it (`<section aria-labelledby>`).
 *
 * ```html
 * <app-section-header heading="Top rated" i18n-heading="@@home.topRated" headingId="top-rated" seeAll="/rankings" />
 * ```
 */
@Component({
  selector: 'app-section-header',
  imports: [RouterLink],
  templateUrl: './section-header.html',
  styleUrl: './section-header.scss'
})
export class SectionHeader {
  readonly heading = input.required<string>();
  readonly headingId = input<string>();
  /** Router link of the full page. */
  readonly seeAll = input<string>();
  readonly seeAllParams = input<Record<string, string>>();
}
