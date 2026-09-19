import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DiscoveryApi } from '@app/core/api/discovery-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';
import { WorkCover } from '@app/shared/ui/work-cover/work-cover';
import { TimeAgoPipe } from '@app/shared/ui/time-ago.pipe';

/** Latest updates (US-08): newest chapters, optionally only my library and followed teams. */
@Component({
  selector: 'app-updates-page',
  imports: [TimeAgoPipe, WorkCover, LoadError, RouterLink],
  templateUrl: './updates-page.html',
  styleUrl: './updates-page.scss'
})
export class UpdatesPage {
  private readonly discovery = inject(DiscoveryApi);
  protected readonly auth = inject(AuthStore);

  /** `?feed=mine` and `?page=` query parameters. */
  readonly feed = input<string>();
  readonly page = input<string>();

  protected readonly canFilter = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly mine = computed(() => this.feed() === 'mine' && this.canFilter());
  protected readonly pageIndex = computed(() => Math.max(0, Math.trunc(Number(this.page())) || 0));
  protected readonly releases = this.discovery.latestResource(this.mine, this.pageIndex);

  constructor() {
    inject(SeoService).update({
      title: 'Latest updates',
      description: 'The newest manga, manhwa and comic chapters on Readora.',
      path: '/updates'
    });
  }
}
