import { Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommunityApi } from '@app/core/api/community-api';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';
import { WorkCard } from '@app/shared/ui/work-card/work-card';

/** A scanlation team's page (US-12): members, series, latest chapters, follow. */
@Component({
  selector: 'app-team-page',
  imports: [LoadError, RouterLink, HasPermissionDirective, WorkCard],
  templateUrl: './team-page.html',
  styleUrl: './team-page.scss'
})
export class TeamPage {
  private readonly api = inject(CommunityApi);
  private readonly seo = inject(SeoService);

  /** Bound from `teams/:projectId`. */
  readonly projectId = input<string>();

  protected readonly team = this.api.teamResource(this.projectId);
  protected readonly following = linkedSignal(() => (this.team.hasValue() ? (this.team.value()?.following ?? false) : false));
  protected readonly followers = linkedSignal(() => (this.team.hasValue() ? (this.team.value()?.followers ?? 0) : 0));
  protected readonly members = computed(() =>
    (this.team.hasValue() ? (this.team.value()?.members ?? []) : []).map((m) => ({ username: m.username, roles: m.roles.join(', ') }))
  );
  protected readonly follow = asyncAction();

  constructor() {
    effect(() => {
      const loaded = this.team.hasValue() ? this.team.value() : undefined;
      if (loaded) {
        this.seo.update({
          title: $localize`:@@community.team.seoTitle:${loaded.name}:name: — scanlation team`,
          description: $localize`:@@community.team.seoDescription:${loaded.name}:name: translates ${loaded.series.title}:series:.`,
          path: `/teams/${loaded.id}`
        });
      }
    });
  }

  protected async toggleFollow(): Promise<void> {
    const id = this.projectId();
    if (!id) return;
    const follow = !this.following();
    await this.follow.run(async () => {
      await firstValueFrom(follow ? this.api.follow(id) : this.api.unfollow(id));
      this.following.set(follow);
      this.followers.update((n) => Math.max(0, n + (follow ? 1 : -1)));
    });
  }
}
