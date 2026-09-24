import { Component, booleanAttribute, computed, input, linkedSignal, numberAttribute } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

/**
 * A series cover: optimized image (lazy unless `priority`), and a screentone placeholder when the series has none or
 * the image fails to load (drawn in CSS, so it follows the theme; no text: the card's title names the series). Size it with a class on the element (width plus height or aspect-ratio); the image fills it.
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

  /** Covers stored before thumbnails existed have none: after a failed thumbnail, show the full cover. */
  private readonly thumbnailFailed = linkedSignal({ source: this.thumbnail, computation: () => false });
  /** Both failed (or the only one did): the placeholder, until another cover is given. */
  private readonly coverFailed = linkedSignal({ source: () => [this.src(), this.thumbnail()], computation: () => false });
  protected readonly shown = computed(() =>
    this.coverFailed() ? null : (this.thumbnailFailed() ? null : this.thumbnail()) || this.src()
  );
  protected readonly ratio = computed(() => `${this.width()} / ${this.height()}`);

  protected handleError(): void {
    if (this.thumbnail() && !this.thumbnailFailed() && this.src()) {
      this.thumbnailFailed.set(true);
    } else {
      this.coverFailed.set(true);
    }
  }
}
