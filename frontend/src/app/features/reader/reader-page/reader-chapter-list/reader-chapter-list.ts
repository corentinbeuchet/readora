import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { groupByNumber, pickVersion } from '@app/core/models/chapter';
import { PreferredTeamStore } from '@app/core/reading/preferred-team-store';
import { LoadError } from '@app/shared/ui/load-error';

/**
 * Chapter list inside the reader (US-07): every chapter of the series with the ones read marked. Its data loads the
 * first time the list is opened for a series, and stays while the reader is open.
 */
@Component({
  selector: 'app-reader-chapter-list',
  imports: [LoadError, RouterLink],
  templateUrl: './reader-chapter-list.html',
  styleUrl: './reader-chapter-list.scss'
})
export class ReaderChapterList {
  private readonly auth = inject(AuthStore);
  private readonly preferredTeam = inject(PreferredTeamStore);

  readonly open = input(false);
  readonly workId = input<string>();
  readonly currentChapterId = input<string>();
  /** A chapter link was chosen: the router opens it in the reader. */
  readonly chosen = output();

  /** The series listed: set when the list is first opened, kept afterwards (no refetch on close). */
  private readonly listedWorkId = linkedSignal<{ open: boolean; workId: string | undefined }, string | undefined>({
    source: () => ({ open: this.open(), workId: this.workId() }),
    computation: (now, previous) => (now.open ? now.workId : previous?.value)
  });
  protected readonly chapters = inject(CatalogApi).chaptersResource(this.listedWorkId);
  private readonly progress = inject(ReadingApi).progressResource(
    this.listedWorkId,
    computed(() => this.auth.can('LIBRARY_USE'))
  );
  /**
   * One row per chapter number (US-12), computed once: it opens the version by the team being read when that team has
   * the chapter, else by my team, else the first one published. Read marks follow the number.
   */
  protected readonly rows = computed(() => {
    const finished = new Set(this.progress.hasValue() ? (this.progress.value()?.finishedChapterNumbers ?? []) : []);
    const chapters = this.chapters.hasValue() ? this.chapters.value() : [];
    const current = chapters.find((chapter) => chapter.id === this.currentChapterId());
    const team = current?.team.id ?? this.preferredTeam.teamFor(this.listedWorkId() ?? '');
    const severalTeams = new Set(chapters.map((chapter) => chapter.team.id)).size > 1;
    return groupByNumber(chapters).map((group) => {
      const chapter = group.versions.find((version) => version.id === current?.id) ?? pickVersion(group.versions, team) ?? group.versions[0];
      return {
        chapter,
        current: chapter.id === current?.id,
        read: finished.has(group.chapterNumber),
        team: severalTeams ? chapter.team.name : null
      };
    });
  });
}
