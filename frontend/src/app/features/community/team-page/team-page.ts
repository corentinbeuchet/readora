import { isDefaultChapterTitle } from '@app/core/models/chapter';
import { Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommunityApi } from '@app/core/api/community-api';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { TeamProfile } from '@app/core/models/community';
import { SCANLATION_ROLE_LABELS } from '@app/core/models/scanlation';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { EmptyState } from '@app/shared/ui/empty-state/empty-state';
import { Icon } from '@app/shared/ui/icon/icon';
import { LoadError } from '@app/shared/ui/load-error';
import { SectionHeader } from '@app/shared/ui/section-header/section-header';
import { WorkCard } from '@app/shared/ui/work-card/work-card';

/** A scanlation team's page (US-12): its series 24 at a time (`?page=`), members, latest chapters, follow. */
@Component({
  selector: 'app-team-page',
  imports: [LoadError, RouterLink, HasPermissionDirective, WorkCard, SectionHeader, EmptyState, Icon],
  templateUrl: './team-page.html',
  styleUrl: './team-page.scss'
})
export class TeamPage {
  private readonly api = inject(CommunityApi);
  private readonly seo = inject(SeoService);

  /** Bound from `teams/:teamId`. */
  readonly teamId = input<string>();
  /** The `?page=` query parameter: the page of the team's series, from 0. */
  readonly page = input<string>();

  protected readonly pageIndex = computed(() => Math.max(0, Math.trunc(Number(this.page())) || 0));
  protected readonly team = this.api.teamResource(this.teamId, this.pageIndex);
  /**
   * The team shown: kept while another page of its series loads (the resource is empty meanwhile), so the header,
   * members and the pager's focused link stay put; another team replaces it.
   */
  protected readonly shown = linkedSignal<TeamProfile | undefined, TeamProfile | undefined>({
    source: () => (this.team.hasValue() ? this.team.value() : undefined),
    computation: (loaded, previous) => loaded ?? (previous?.value?.id === this.teamId() ? previous?.value : undefined)
  });
  protected readonly following = linkedSignal(() => this.shown()?.following ?? false);
  protected readonly followers = linkedSignal(() => this.shown()?.followers ?? 0);
  protected readonly members = computed(() =>
    (this.shown()?.members ?? []).map((m) => ({ username: m.username, roles: m.roles.map((role) => SCANLATION_ROLE_LABELS[role]) }))
  );
  /** The latest chapters with the title of their series: the team may translate several. */
  protected readonly latestChapters = computed(() => {
    const loaded = this.shown();
    const titles = new Map((loaded?.latestSeries ?? []).map((series) => [series.id, series.title]));
    return (loaded?.latestChapters ?? []).map((chapter) => ({
      chapter,
      seriesTitle: titles.get(chapter.workId) ?? '',
      // Its own title, or nothing when it only repeats "Chapter N" (the link already says the number).
      title: isDefaultChapterTitle(chapter.title, chapter.chapterNumber) ? null : chapter.title
    }));
  });
  protected readonly follow = asyncAction();

  constructor() {
    effect(() => {
      const loaded = this.shown();
      if (loaded) {
        this.seo.update({
          title: $localize`:@@community.team.seoTitle:${loaded.name}:name: — scanlation team`,
          description: loaded.description ?? $localize`:@@community.team.seoDescriptionSeries:${loaded.name}:name: translates ${loaded.series.items.map((entry) => entry.work.title).join(', ')}:series:.`,
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
