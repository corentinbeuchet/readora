import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
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
  readonly upvote = output<string>();
  readonly reply = output<ChapterComment>();

  readonly revealedSpoilers = new Set<string>();

  revealSpoiler(commentId: string): void {
    this.revealedSpoilers.add(commentId);
  }
}
