import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';
import { WorkCover } from '@app/shared/ui/work-cover/work-cover';

/** Reading history (US-07): the series I read most recently, each with a "Continue" button. */
@Component({
  selector: 'app-history-page',
  imports: [WorkCover, LoadError, RouterLink, DatePipe],
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss'
})
export class HistoryPage {
  private readonly auth = inject(AuthStore);

  private readonly enabled = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly history = inject(ReadingApi).historyResource(this.enabled);
  /** Accessible name of each row's "Continue" link, by series id. */
  protected readonly continueLabels = computed(
    () =>
      new Map(
        (this.history.hasValue() ? this.history.value() : []).map((item) => [
          item.work.id,
          $localize`:@@library.history.continue.label:Continue ${item.work.title}:title:, chapter ${item.lastRead.chapterNumber}:chapter:`
        ])
      )
  );

  constructor() {
    inject(SeoService).private_($localize`:@@library.history.seoTitle:Reading history`);
  }

  protected reload(): void {
    this.history.reload();
  }
}
