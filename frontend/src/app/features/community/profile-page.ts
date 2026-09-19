import { Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommunityApi } from '@app/core/api/community-api';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';

/** A reader's public profile (US-12): chapters read, favourite genres, completed series. */
@Component({
  selector: 'app-public-profile-page',
  imports: [LoadError, RouterLink, DatePipe],
  templateUrl: './profile-page.html',
  styleUrl: './community.scss'
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
        this.seo.update({ title: `${loaded.displayName} (@${loaded.username})`, description: `${loaded.displayName} on Readora.`, path: `/u/${loaded.username}` });
      }
    });
  }
}
