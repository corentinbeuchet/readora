import { Component, computed, inject, output } from '@angular/core';
import { ReaderState } from '@app/features/reader/reader-page/reader-state';

/** Thin progress bar that is also a page slider (US-07); fills from the right in right-to-left reading. */
@Component({
  selector: 'app-page-progress',
  templateUrl: './page-progress.html',
  styleUrl: './page-progress.scss'
})
export class PageProgress {
  protected readonly state = inject(ReaderState);

  protected readonly valueText = computed(
    () => $localize`:@@reader.progress.valueText:Page ${this.state.currentPageIndex() + 1}:page: of ${this.state.totalPages()}:total:`
  );

  /** 0-based page chosen with the slider. */
  readonly jumped = output<number>();

  protected jump(value: string): void {
    this.jumped.emit(Number(value) - 1);
  }
}
