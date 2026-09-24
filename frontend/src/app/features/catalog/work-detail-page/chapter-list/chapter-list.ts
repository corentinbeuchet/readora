import { Icon } from '@app/shared/ui/icon/icon';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChapterSummary, groupByNumber, pickVersion, teamsOf } from '@app/core/models/chapter';
import { WorkProgress } from '@app/core/models/library';
import { PreferredTeamStore } from '@app/core/reading/preferred-team-store';

/** Teams named in a row before the rest goes behind "N more teams". */
const TEAMS_SHOWN = 3;

/**
 * The chapters of a series, one row per chapter number (US-12): several teams may have translated the same chapter,
 * so a row opens one version (the chosen team's, else my team's, else the first published) and links to the others.
 * Read marks and "Next up" follow the number. Filter and sort live in the URL (`?team=&order=`).
 */
@Component({
  selector: 'app-chapter-list',
  imports: [Icon, RouterLink, DatePipe],
  templateUrl: './chapter-list.html',
  styleUrl: './chapter-list.scss'
})
export class ChapterList {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly preferredTeam = inject(PreferredTeamStore);

  readonly workId = input.required<string>();
  /** Every published version, versions of one number next to each other (the API's order). */
  readonly chapters = input.required<ChapterSummary[]>();
  /** My progress in the series, `null` for guests or while it loads. */
  readonly progress = input<WorkProgress | null>(null);
  /** Whether "Mark all previous as read" can be offered. */
  readonly canMark = input(false);
  readonly busy = input(false);
  /** `?team=`: only chapters this team translated, in its version. */
  readonly team = input<string>();
  /** `?order=newest`: the last chapter first. */
  readonly order = input<string>();
  /** A chapter id: everything before its number should be marked as read. */
  readonly markPrevious = output<string>();

  protected readonly teams = computed(() => teamsOf(this.chapters()));
  protected readonly filteredTeam = computed(() => this.teams().find((share) => share.team.id === this.team())?.team ?? null);
  protected readonly newestFirst = computed(() => this.order() === 'newest');
  /** Rows whose extra teams are shown. */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  /**
   * One entry per row, computed in a single pass in reading order (so "Mark all previous as read" knows whether an
   * unread number comes before), then reversed for "Newest first".
   */
  protected readonly rows = computed(() => {
    const progress = this.progress();
    const finished = new Set(progress?.finishedChapterNumbers ?? []);
    const filter = this.filteredTeam()?.id ?? null;
    const wanted = filter ?? this.preferredTeam.teamFor(this.workId());
    const expanded = this.expanded();
    let unreadBefore = false;
    const rows = groupByNumber(this.chapters()).map((group) => {
      const read = finished.has(group.chapterNumber);
      const next = group.chapterNumber === progress?.nextChapterNumber;
      // Without a team of my own, "Next up" opens the version the server chose (the team I read last).
      const serverChoice = next && !wanted ? group.versions.find((version) => version.id === progress?.nextChapterId) : undefined;
      const opens = serverChoice ?? pickVersion(group.versions, wanted) ?? group.versions[0];
      const others = group.versions.filter((version) => version.id !== opens.id);
      const showAll = expanded.has(group.chapterNumber) || others.length < TEAMS_SHOWN;
      const row = {
        number: group.chapterNumber,
        opens,
        others: showAll ? others : others.slice(0, TEAMS_SHOWN - 1),
        hidden: showAll ? 0 : others.length - (TEAMS_SHOWN - 1),
        expanded: expanded.has(group.chapterNumber),
        translatedByFilter: filter === null || group.versions.some((version) => version.team.id === filter),
        read,
        next,
        canMarkPrevious: this.canMark() && progress !== null && !read && unreadBefore
      };
      unreadBefore ||= !read;
      return row;
    });
    const listed = rows.filter((row) => row.translatedByFilter);
    return this.newestFirst() ? listed.reverse() : listed;
  });

  protected filterByTeam(teamId: string): void {
    this.changeUrl({ team: teamId || null });
  }

  protected sort(order: 'newest' | null): void {
    this.changeUrl({ order });
  }

  protected toggleTeams(number: string): void {
    this.expanded.update((numbers) => {
      const next = new Set(numbers);
      if (!next.delete(number)) {
        next.add(number);
      }
      return next;
    });
  }

  /** Picking a team's version on purpose is what makes it my team for this series. */
  protected rememberTeam(version: ChapterSummary): void {
    this.preferredTeam.remember(this.workId(), version.team.id);
  }

  /** Stays on the chapter list: a plain query change would scroll back to the top of the page. */
  private changeUrl(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', fragment: 'chapters', replaceUrl: true });
  }
}
