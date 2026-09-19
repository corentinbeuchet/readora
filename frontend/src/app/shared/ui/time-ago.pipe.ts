import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { timeAgo } from '@app/core/utils/time-ago';

/** `{{ release.publishedAt | timeAgo }}` → "10 minutes ago" in the build's language (see [timeAgo]). */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(iso: string | null | undefined): string {
    return iso ? timeAgo(iso, Date.now(), this.locale) : '';
  }
}
