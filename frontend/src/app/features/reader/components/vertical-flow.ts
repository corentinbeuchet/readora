import { Component, DOCUMENT, DestroyRef, ElementRef, afterRenderEffect, inject, untracked, viewChildren } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FALLBACK_PAGE_IMAGE, onImageError } from '@app/core/utils/image-utils';
import { ReaderPreferencesStore } from '@app/features/reader/services/reader-preferences-store';
import { ReaderState } from '@app/features/reader/services/reader-state';

/**
 * Vertical (webtoon) mode: every page one below the other. The page crossing the middle of the viewport is the
 * current page; a chapter opened away from page 1 scrolls there once.
 */
@Component({
  selector: 'app-vertical-flow',
  imports: [NgOptimizedImage],
  templateUrl: './vertical-flow.html',
  styleUrl: './vertical-flow.scss',
  host: {
    '[class.fit-width]': "prefs.fit() === 'WIDTH'",
    '[class.fit-height]': "prefs.fit() === 'HEIGHT'",
    '[class.fit-original]': "prefs.fit() === 'ORIGINAL'"
  }
})
export class VerticalFlow {
  protected readonly state = inject(ReaderState);
  protected readonly prefs = inject(ReaderPreferencesStore);
  private readonly document = inject(DOCUMENT);
  protected readonly fallbackPage = FALLBACK_PAGE_IMAGE;
  protected readonly handlePageError = onImageError;

  private readonly pageWrappers = viewChildren<ElementRef<HTMLElement>>('pageWrapper');

  constructor() {
    // Browser-only (afterRenderEffect never runs on the server / during prerender).
    let observer: IntersectionObserver | null = null;
    let scrolledFor: string | null = null;
    afterRenderEffect({
      write: () => {
        const wrappers = this.pageWrappers();
        observer?.disconnect();
        observer = null;
        if (wrappers.length === 0) {
          return;
        }
        const chapterId = this.state.currentChapter()?.id ?? null;
        if (chapterId !== scrolledFor) {
          scrolledFor = chapterId;
          const index = untracked(this.state.currentPageIndex);
          if (index > 0) {
            wrappers[index]?.nativeElement.scrollIntoView?.({ block: 'start' });
          }
        }
        const Observer = this.document.defaultView?.IntersectionObserver;
        if (!Observer) {
          return;
        }
        observer = new Observer(
          (entries) => {
            for (const entry of entries) {
              const index = Number((entry.target as HTMLElement).dataset['pageIndex']);
              if (entry.isIntersecting && Number.isInteger(index)) {
                this.state.goToPage(index);
              }
            }
          },
          { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
        );
        for (const wrapper of wrappers) {
          observer.observe(wrapper.nativeElement);
        }
      }
    });
    inject(DestroyRef).onDestroy(() => observer?.disconnect());
  }

  /** Brings a page into view (page slider). */
  scrollToPage(index: number): void {
    this.pageWrappers()[index]?.nativeElement.scrollIntoView?.({ block: 'start' });
  }
}
