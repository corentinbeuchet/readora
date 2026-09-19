import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ChapterComment } from '@app/core/models/readora.models';

@Component({
  selector: 'app-comment-tree',
  imports: [DatePipe],
  templateUrl: './comment-tree.html',
  styleUrl: './comment-tree.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommentTree {
  readonly comments = input<ChapterComment[]>([]);
  /** Whether the current user may upvote (`COMMENT_UPVOTE`). Defaults to true for presentational use. */
  readonly canUpvote = input(true);
  /** Whether the current user may reply (`COMMENT_WRITE`). Defaults to true for presentational use. */
  readonly canReply = input(true);
  /** Comment to highlight (from a notification link). */
  readonly highlightId = input<string | undefined>(undefined);
  readonly upvote = output<string>();
  readonly reply = output<ChapterComment>();

  /** Ids of spoilers the reader chose to reveal. Hidden spoiler text is never rendered (nor prerendered). */
  protected readonly revealedSpoilers = signal<ReadonlySet<string>>(new Set());

  protected isHidden(comment: ChapterComment): boolean {
    return comment.isSpoiler && !this.revealedSpoilers().has(comment.id);
  }

  protected revealSpoiler(commentId: string): void {
    this.revealedSpoilers.update((ids) => new Set(ids).add(commentId));
  }
}
