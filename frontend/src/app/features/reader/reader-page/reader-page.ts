import { Component, DOCUMENT, DestroyRef, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChaptersApi } from '@app/core/api/chapters-api';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { LayoutStore } from '@app/core/layout/layout-store';
import { SeoService } from '@app/core/seo/seo.service';
import { ChapterComments } from '@app/features/social/chapter-comments/chapter-comments';
import { LoadError } from '@app/shared/ui/load-error';
import { ChapterEnd } from './chapter-end/chapter-end';
import { PageProgress } from './page-progress/page-progress';
import { PagedFlow } from './paged-flow/paged-flow';
import { ReaderChapterList } from './reader-chapter-list/reader-chapter-list';
import { ReaderSettingsPanel } from './reader-settings-panel/reader-settings-panel';
import { ReaderToolbar } from './reader-toolbar/reader-toolbar';
import { ReportPageDialog } from './report-page-dialog/report-page-dialog';
import { VerticalFlow } from './vertical-flow/vertical-flow';
import { AutoScroller } from './auto-scroller';
import { ReaderPreferencesStore } from './reader-preferences-store';
import { ReaderState } from './reader-state';
import { ReadingTracker } from './reading-tracker';

export { PROGRESS_SYNC_DEBOUNCE_MS } from './reading-tracker';

/** Screens at least this wide can show two pages side by side. */
export const DOUBLE_PAGE_MEDIA_QUERY = '(min-width: 1024px)';
/** In zen mode the controls hide again this long after the last mouse move or tap. */
export const ZEN_CONTROLS_HIDE_MS = 3000;

/** Parses the `?page=N` query param (1-based) into a 0-based index, or `null` when absent/invalid. */
function pageParamToIndex(raw: string | number | null | undefined): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return raw !== null && raw !== undefined && raw !== '' && Number.isInteger(n) && n >= 1 ? n - 1 : null;
}

/**
 * The reader (`read/:chapterId`): loads the chapter and hosts the reader parts. The reading state, history/bookmark
 * tracking and auto-scroll are provided here, so each visit of the reader starts clean.
 */
@Component({
  selector: 'app-reader-page',
  imports: [
    RouterLink,
    HasPermissionDirective,
    ReaderToolbar,
    ReaderSettingsPanel,
    ReaderChapterList,
    PageProgress,
    VerticalFlow,
    PagedFlow,
    ChapterEnd,
    ChapterComments,
    ReportPageDialog,
    LoadError
  ],
  templateUrl: './reader-page.html',
  styleUrl: './reader-page.scss',
  providers: [ReaderState, ReadingTracker, AutoScroller],
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:mousemove)': 'revealControls()',
    '(document:pointerdown)': 'revealControls()'
  }
})
export class ReaderPage {
  protected readonly state = inject(ReaderState);
  protected readonly tracker = inject(ReadingTracker);
  protected readonly prefs = inject(ReaderPreferencesStore);
  private readonly seo = inject(SeoService);
  private readonly layout = inject(LayoutStore);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from `read/:chapterId`. */
  readonly chapterId = input<string | undefined>(undefined);
  /** Bound from the `?page=N` query param (1-based), e.g. from "Continue reading". */
  readonly page = input<string | number | undefined>(undefined);
  /** Bound from `?comment=`: a notification points at this comment, so the thread loads right away. */
  readonly comment = input<string | undefined>(undefined);

  private readonly toolbar = viewChild(ReaderToolbar);
  private readonly verticalFlow = viewChild(VerticalFlow);

  protected readonly chapter = inject(ChaptersApi).chapterResource(this.chapterId);
  protected readonly settingsOpen = signal(false);
  protected readonly chaptersOpen = signal(false);
  /** Page number being reported (US-06), `null` when the dialog is closed. */
  protected readonly reportingPage = signal<number | null>(null);
  protected readonly reportConfirmation = signal<string | null>(null);
  /** Zen mode (US-06): no site header, reader controls auto-hide. */
  protected readonly zen = signal(false);
  private readonly controlsVisible = signal(true);
  protected readonly controlsHidden = computed(() => this.zen() && !this.controlsVisible());
  private hideControlsTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Reading takes the whole screen: no tab bar over the pages on a phone.
    this.layout.setTabBarHidden(true);
    this.state.connect(
      computed(() => (this.chapter.hasValue() ? (this.chapter.value() ?? null) : null)),
      computed(() => pageParamToIndex(this.page()))
    );

    effect(() => {
      if (this.chapter.error()) {
        untracked(() => this.seo.notFound($localize`:@@reader.page.seoUnavailable:Chapter unavailable`));
        return;
      }
      const loaded = this.state.currentChapter();
      if (loaded) {
        untracked(() =>
          this.seo.update({
            title: $localize`:@@reader.page.seoTitle:${loaded.title}:title: — Chapter ${loaded.chapterNumber}:number:`,
            description: $localize`:@@reader.page.seoDescription:Read chapter ${loaded.chapterNumber}:number: (${loaded.pages.length}:pages: pages) online on Readora.`,
            path: `/read/${loaded.id}`,
            image: loaded.pages[0]?.cdnUrl ?? undefined,
            type: 'article'
          })
        );
      }
    });

    afterNextRender(() => {
      this.state.markHydrated();
      const media = this.document.defaultView?.matchMedia?.(DOUBLE_PAGE_MEDIA_QUERY);
      if (media) {
        this.state.setWideScreen(media.matches);
        const onChange = (event: MediaQueryListEvent) => this.state.setWideScreen(event.matches);
        media.addEventListener?.('change', onChange);
        this.destroyRef.onDestroy(() => media.removeEventListener?.('change', onChange));
      }
    });

    this.destroyRef.onDestroy(() => {
      this.clearHideTimer();
      this.layout.setImmersive(false);
      this.layout.setTabBarHidden(false);
    });
  }

  /**
   * Escape closes the open panel (focus back on its button), then leaves zen mode. Paged mode keys: arrows follow
   * the reading direction, Space / Page Down go forward, Shift+Space / Page Up back. Ignored while typing in a field,
   * inside a dialog, or with a modifier held (browser shortcuts); vertical mode scrolls natively.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if ((event.target as HTMLElement | null)?.closest?.('[role="dialog"]')) {
      return;
    }
    if (event.key === 'Escape' && !event.defaultPrevented) {
      if (this.chaptersOpen() || this.settingsOpen()) {
        event.preventDefault();
        const panel = this.chaptersOpen() ? 'chapters' : 'settings';
        this.chaptersOpen.set(false);
        this.settingsOpen.set(false);
        this.toolbar()?.focusToggle(panel);
      } else if (this.zen()) {
        this.setZen(false);
      }
      return;
    }
    if (this.state.viewMode() !== 'PAGED' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if ((event.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) {
      return;
    }
    const rtl = this.state.direction() === 'RTL';
    const turns: Record<string, boolean> = { ArrowRight: !rtl, ArrowLeft: rtl, ' ': !event.shiftKey, PageDown: true, PageUp: false };
    const forward = turns[event.key];
    if (forward === undefined) {
      return;
    }
    event.preventDefault();
    if (forward) {
      this.state.nextPage();
    } else {
      this.state.previousPage();
    }
  }

  protected toggleSettings(): void {
    this.settingsOpen.update((open) => !open);
  }

  protected toggleChapters(): void {
    this.chaptersOpen.update((open) => !open);
  }

  protected jumpToPage(index: number): void {
    this.state.goToPage(index);
    this.verticalFlow()?.scrollToPage(index);
  }

  protected openReport(): void {
    const page = this.state.currentPage();
    if (page) {
      this.reportConfirmation.set(null);
      this.reportingPage.set(page.pageNumber);
    }
  }

  protected onReported(pageNumber: number): void {
    this.reportingPage.set(null);
    this.reportConfirmation.set($localize`:@@reader.page.reported:Thanks! Page ${pageNumber}:page: was reported to the team.`);
  }

  /** Zen mode on: site header gone, reader controls hidden until the mouse moves or the screen is tapped. */
  protected setZen(on: boolean): void {
    this.zen.set(on);
    this.layout.setImmersive(on);
    this.clearHideTimer();
    this.controlsVisible.set(!on);
  }

  /** Mouse move, tap, or keyboard focus on a control: show the controls, then hide them again after a pause. */
  protected revealControls(): void {
    if (!this.zen()) {
      return;
    }
    this.controlsVisible.set(true);
    this.clearHideTimer();
    this.hideControlsTimer = setTimeout(() => this.controlsVisible.set(false), ZEN_CONTROLS_HIDE_MS);
  }

  private clearHideTimer(): void {
    if (this.hideControlsTimer !== null) {
      clearTimeout(this.hideControlsTimer);
      this.hideControlsTimer = null;
    }
  }
}
