import { Component, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { CommunityApi } from '@app/core/api/community-api';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';

/** A scanlation team's page (US-12): members, series, latest chapters, follow. */
@Component({
  selector: 'app-team-page',
  imports: [RouterLink, HasPermissionDirective],
  templateUrl: './team-page.html',
  styleUrl: './community.scss'
})
export class TeamPageComponent {
  private readonly api = inject(CommunityApi);
  private readonly seo = inject(SeoService);

  /** Bound from `teams/:projectId`. */
  readonly projectId = input<string>();

  protected readonly team = this.api.teamResource(this.projectId);
  protected readonly following = linkedSignal(() => (this.team.hasValue() ? (this.team.value()?.following ?? false) : false));
  protected readonly followers = linkedSignal(() => (this.team.hasValue() ? (this.team.value()?.followers ?? 0) : 0));
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const loaded = this.team.hasValue() ? this.team.value() : undefined;
      if (loaded) {
        this.seo.update({ title: `${loaded.name} — scanlation team`, description: `${loaded.name} translates ${loaded.series.title}.`, path: `/teams/${loaded.id}` });
      }
    });
  }

  protected async toggleFollow(): Promise<void> {
    const id = this.projectId();
    if (!id) return;
    const follow = !this.following();
    this.saving.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(follow ? this.api.follow(id) : this.api.unfollow(id));
      this.following.set(follow);
      this.followers.update((n) => Math.max(0, n + (follow ? 1 : -1)));
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
