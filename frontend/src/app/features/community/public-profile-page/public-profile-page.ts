import { WorkCardSkeleton } from '@app/shared/ui/work-card-skeleton/work-card-skeleton';
import { SectionHeader } from '@app/shared/ui/section-header/section-header';
import { Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommunityApi } from '@app/core/api/community-api';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';
import { WorkCard } from '@app/shared/ui/work-card/work-card';

/** A reader's public profile (US-12): chapters read, favourite genres, completed series. */
@Component({
  selector: 'app-public-profile-page',
  imports: [NgOptimizedImage, SectionHeader, WorkCardSkeleton, LoadError, RouterLink, DatePipe, WorkCard],
  templateUrl: './public-profile-page.html',
  styleUrl: './public-profile-page.scss'
})
export class PublicProfilePage {
  private readonly seo = inject(SeoService);

  /** Bound from `u/:username`. */
  readonly username = input<string>();

  protected readonly profile = inject(CommunityApi).profileResource(this.username);
  protected readonly favouriteGenres = computed(() => (this.profile.hasValue() ? this.profile.value()?.favouriteGenres.join(', ') : '') || '—');

  constructor() {
    effect(() => {
      const loaded = this.profile.hasValue() ? this.profile.value() : undefined;
      if (loaded) {
        this.seo.update({ title: `${loaded.displayName} (@${loaded.username})`, description: $localize`:@@community.profile.seoDescription:${loaded.displayName}:name: on Readora.`, path: `/u/${loaded.username}` });
      }
    });
  }
}
