import { Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommunityApi } from '@app/core/api/community-api';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { EmptyState } from '@app/shared/ui/empty-state/empty-state';
import { LoadError } from '@app/shared/ui/load-error';
import { SectionHeader } from '@app/shared/ui/section-header/section-header';
import { WorkCard } from '@app/shared/ui/work-card/work-card';

/** A scanlation team's page (US-12): every series it translates, members, latest chapters, follow. */
@Component({
  selector: 'app-team-page',
  imports: [LoadError, RouterLink, HasPermissionDirective, WorkCard, SectionHeader, EmptyState],
  templateUrl: './team-page.html',
  styleUrl: './team-page.scss'
})
export class TeamPage {
  private readonly api = inject(CommunityApi);
  private readonly seo = inject(SeoService);

  /** Bound from `teams/:teamId`. */
  readonly teamId = input<string>();

  protected readonly team = this.api.teamResource(this.teamId);
  protected readonly following = linkedSignal(() => (this.team.hasValue() ? (this.team.value()?.following ?? false) : false));
  protected readonly followers = linkedSignal(() => (this.team.hasValue() ? (this.team.value()?.followers ?? 0) : 0));
  protected readonly members = computed(() =>
    (this.team.hasValue() ? (this.team.value()?.members ?? []) : []).map((m) => ({ username: m.username, roles: m.roles.join(', ') }))
  );
  /** The latest chapters with the title of their series: the team may translate several. */
  protected readonly latestChapters = computed(() => {
    const loaded = this.team.hasValue() ? this.team.value() : undefined;
    const titles = new Map((loaded?.series ?? []).map((entry) => [entry.work.id, entry.work.title]));
    return (loaded?.latestChapters ?? []).map((chapter) => ({ chapter, seriesTitle: titles.get(chapter.workId) ?? '' }));
  });
  protected readonly follow = asyncAction();

  constructor() {
    effect(() => {
      const loaded = this.team.hasValue() ? this.team.value() : undefined;
      if (loaded) {
        this.seo.update({
          title: $localize`:@@community.team.seoTitle:${loaded.name}:name: — scanlation team`,
          description: loaded.description ?? $localize`:@@community.team.seoDescriptionSeries:${loaded.name}:name: translates ${loaded.series.map((entry) => entry.work.title).join(', ')}:series:.`,
          path: `/teams/${loaded.id}`
        });
      }
    });
  }

  protected async toggleFollow(): Promise<void> {
    const id = this.teamId();
    if (!id) return;
    const follow = !this.following();
    await this.follow.run(async () => {
      await firstValueFrom(follow ? this.api.follow(id) : this.api.unfollow(id));
      this.following.set(follow);
      this.followers.update((n) => Math.max(0, n + (follow ? 1 : -1)));
    });
  }
}
