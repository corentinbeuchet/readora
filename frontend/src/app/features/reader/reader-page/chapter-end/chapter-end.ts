import { Component, computed, inject, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommentsApi } from '@app/core/api/comments-api';
import { ChapterNeighbour } from '@app/core/models/chapter';
import { PreferredTeamStore } from '@app/core/reading/preferred-team-store';
import { ReaderState } from '@app/features/reader/reader-page/reader-state';

/** End of the chapter: previous / next chapter and the chapter list, then the best comments (US-07). */
@Component({
  selector: 'app-chapter-end',
  imports: [RouterLink],
  templateUrl: './chapter-end.html',
  styleUrl: './chapter-end.scss'
})
export class ChapterEnd {
  protected readonly state = inject(ReaderState);
  private readonly preferredTeam = inject(PreferredTeamStore);

  /**
   * Where "Previous chapter" and "Next chapter" go: my team's version when it has that chapter (US-12), otherwise the
   * server's choice (the team I am reading, else the first version published).
   */
  protected readonly previousId = computed(() => {
    const chapter = this.state.currentChapter();
    return chapter ? this.versionOf(chapter.workId, chapter.previous, chapter.previousChapterId) : null;
  });
  protected readonly nextId = computed(() => {
    const chapter = this.state.currentChapter();
    return chapter ? this.versionOf(chapter.workId, chapter.next, chapter.nextChapterId) : null;
  });

  /** Chapter whose last page the reader reached: its best comments load then, and stay while it is open. */
  private readonly endReachedFor = linkedSignal<{ id: string | null; last: boolean }, string | null>({
    source: () => ({ id: this.state.currentChapter()?.id ?? null, last: this.state.isLastPage() }),
    computation: (now, previous) => (now.last && now.id ? now.id : previous?.value === now.id ? now.id : null)
  });
  protected readonly topComments = inject(CommentsApi).topResource(this.endReachedFor);

  private versionOf(workId: string, neighbour: ChapterNeighbour | null, serverChoice: string | null): string | null {
    const mine = this.preferredTeam.teamFor(workId);
    return neighbour?.versions.find((version) => version.team.id === mine)?.chapterId ?? serverChoice;
  }
}
