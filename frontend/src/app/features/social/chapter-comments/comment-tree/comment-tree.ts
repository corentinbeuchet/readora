import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChapterComment } from '@app/core/models/comments';

@Component({
  selector: 'app-comment-tree',
  imports: [DatePipe, RouterLink],
  templateUrl: './comment-tree.html',
  styleUrl: './comment-tree.scss'
})
export class CommentTree {
  readonly comments = input<ChapterComment[]>([]);
  /** Whether the current user may upvote (`COMMENT_UPVOTE`). Defaults to true for presentational use. */
  readonly canUpvote = input(true);
  /** Whether the current user may reply (`COMMENT_WRITE`). Defaults to true for presentational use. */
  readonly canReply = input(true);
  /** Comment to highlight (from a notification link). */
  readonly highlightId = input<string | undefined>(undefined);
  /** Whether the current user may report comments (`COMMENT_REPORT`). */
  readonly canReport = input(false);
  /** The signed-in reader, whose own comments can't be reported. */
  readonly currentUserId = input<string | null>(null);
  readonly report = output<ChapterComment>();
  readonly upvote = output<string>();
  readonly reply = output<ChapterComment>();

  /** Ids of spoilers the reader chose to reveal. Hidden spoiler text is never rendered (nor prerendered). */
  protected readonly revealedSpoilers = signal<ReadonlySet<string>>(new Set());

  /** Each comment with whether its spoiler is still hidden (computed once, not per template call). */
  protected readonly rows = computed(() => {
    const revealed = this.revealedSpoilers();
    return this.comments().map((comment) => ({ comment, hidden: comment.isSpoiler && !revealed.has(comment.id) }));
  });

  protected revealSpoiler(commentId: string): void {
    this.revealedSpoilers.update((ids) => new Set(ids).add(commentId));
  }
}
