import { Component, booleanAttribute, computed, input, linkedSignal, numberAttribute } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FALLBACK_COVER_IMAGE, onImageError } from '@app/core/utils/image-utils';

/**
 * A series cover: optimized image (lazy unless `priority`), and the placeholder cover when the series has none or the
 * image fails to load. Size it with a class on the element (width plus height or aspect-ratio); the image fills it.
 * Pass the series' `coverThumbnailUrl` as `thumbnail`: it is shown instead of the full cover (every cover is drawn at
 * most 240 px wide, the thumbnail is 480 px), and the full cover takes over if the thumbnail fails to load.
 */
@Component({
  selector: 'app-work-cover',
  imports: [NgOptimizedImage],
  templateUrl: './work-cover.html',
  styleUrl: './work-cover.scss'
})
export class WorkCover {
  readonly src = input<string | null | undefined>();
  /** The cover resized for cards and lists (`coverThumbnailUrl`); `null` for a cover hosted elsewhere. */
  readonly thumbnail = input<string | null | undefined>();
  /** Empty when the cover sits next to the title (decorative). */
  readonly alt = input('');
  readonly width = input.required({ transform: numberAttribute });
  readonly height = input.required({ transform: numberAttribute });
  /** The LCP image (first cover of a page): loaded eagerly with high priority. */
  readonly priority = input(false, { transform: booleanAttribute });

  protected readonly fallback = FALLBACK_COVER_IMAGE;
  /** Covers stored before thumbnails existed have none: after a failed thumbnail, show the full cover. */
  private readonly thumbnailFailed = linkedSignal({ source: this.thumbnail, computation: () => false });
  protected readonly shown = computed(() => (this.thumbnailFailed() ? null : this.thumbnail()) || this.src());

  protected handleError(event: Event): void {
    if (this.thumbnail() && !this.thumbnailFailed() && this.src()) {
      this.thumbnailFailed.set(true);
      return;
    }
    onImageError(event, this.fallback);
  }
}
