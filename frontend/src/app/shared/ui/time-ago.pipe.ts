import { Pipe, PipeTransform } from '@angular/core';
import { timeAgo } from '@app/core/utils/time-ago';

/** `{{ release.publishedAt | timeAgo }}` → "10 minutes ago" (see [timeAgo]). */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return iso ? timeAgo(iso) : '';
  }
}
