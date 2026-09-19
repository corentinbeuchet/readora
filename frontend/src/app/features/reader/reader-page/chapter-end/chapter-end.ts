import { Component, inject, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommentsApi } from '@app/core/api/comments-api';
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

  /** Chapter whose last page the reader reached: its best comments load then, and stay while it is open. */
  private readonly endReachedFor = linkedSignal<{ id: string | null; last: boolean }, string | null>({
    source: () => ({ id: this.state.currentChapter()?.id ?? null, last: this.state.isLastPage() }),
    computation: (now, previous) => (now.last && now.id ? now.id : previous?.value === now.id ? now.id : null)
  });
  protected readonly topComments = inject(CommentsApi).topResource(this.endReachedFor);
}
