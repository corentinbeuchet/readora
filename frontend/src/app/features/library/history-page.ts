import { Component, computed, inject } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { FALLBACK_COVER_IMAGE, onImageError } from '@app/core/utils/image-utils';
import { LoadError } from '@app/shared/ui/load-error';

/** Reading history (US-07): the series I read most recently, each with a "Continue" button. */
@Component({
  selector: 'app-history-page',
  imports: [LoadError, RouterLink, NgOptimizedImage, DatePipe],
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss'
})
export class HistoryPage {
  private readonly auth = inject(AuthStore);
  protected readonly fallbackCover = FALLBACK_COVER_IMAGE;
  protected readonly handleCoverError = onImageError;

  private readonly enabled = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly history = inject(ReadingApi).historyResource(this.enabled);

  constructor() {
    inject(SeoService).private_('Reading history');
  }

  protected reload(): void {
    this.history.reload();
  }
}
