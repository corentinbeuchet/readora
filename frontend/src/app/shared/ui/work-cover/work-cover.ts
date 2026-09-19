import { Component, booleanAttribute, input, numberAttribute } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FALLBACK_COVER_IMAGE, onImageError } from '@app/core/utils/image-utils';

/**
 * A series cover: optimized image (lazy unless `priority`), and the placeholder cover when the series has none or the
 * image fails to load. Size it with a class on the element (width plus height or aspect-ratio); the image fills it.
 */
@Component({
  selector: 'app-work-cover',
  imports: [NgOptimizedImage],
  templateUrl: './work-cover.html',
  styleUrl: './work-cover.scss'
})
export class WorkCover {
  readonly src = input<string | null | undefined>();
  /** Empty when the cover sits next to the title (decorative). */
  readonly alt = input('');
  readonly width = input.required({ transform: numberAttribute });
  readonly height = input.required({ transform: numberAttribute });
  /** The LCP image (first cover of a page): loaded eagerly with high priority. */
  readonly priority = input(false, { transform: booleanAttribute });

  protected readonly fallback = FALLBACK_COVER_IMAGE;
  protected readonly handleError = onImageError;
}
