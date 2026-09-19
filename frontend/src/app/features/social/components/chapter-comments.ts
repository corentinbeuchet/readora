import { ChangeDetectionStrategy, Component, DOCUMENT, afterRenderEffect, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form, maxLength, min, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { CommentsApi } from '@app/core/api/comments-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { ChapterComment } from '@app/core/models/readora.models';
import { AnyField, apiErrorMessage, visibleErrors } from '@app/features/auth/auth-form.utils';
import { CommentTree } from './comment-tree';

export const COMMENT_MAX_LENGTH = 2000;

/**
 * Inserts a new comment in thread (pre-order) order: a reply goes right after its parent's last
 * descendant, a top-level comment (or one whose parent is unknown) at the end. Pure.
 */
export function insertInThread(list: readonly ChapterComment[], created: ChapterComment): ChapterComment[] {
  const parentIndex = created.parentId ? list.findIndex((c) => c.id === created.parentId) : -1;
  if (parentIndex === -1) {
    return [...list, created];
  }
  const parentDepth = list[parentIndex].depth;
  let insertAt = parentIndex + 1;
  while (insertAt < list.length && list[insertAt].depth > parentDepth) {
    insertAt++;
  }
  return [...list.slice(0, insertAt), created, ...list.slice(insertAt)];
}

interface CommentModel {
  content: string;
  pageReference: number | null;
  isSpoiler: boolean;
}

/**
 * Comment section of a chapter: loads the thread from the API, wraps the presentational
 * `CommentTree`, and offers a Signal Forms compose/reply box gated by `COMMENT_WRITE`.
 * Upvotes are gated by `COMMENT_UPVOTE`.
 */
@Component({
  selector: 'app-chapter-comments',
  imports: [RouterLink, FormField, HasPermissionDirective, CommentTree],
  templateUrl: './chapter-comments.html',
  styleUrl: './chapter-comments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChapterComments {
  private readonly commentsApi = inject(CommentsApi);
  protected readonly auth = inject(AuthStore);

  readonly chapterId = input.required<string>();
  /** Comment to highlight and scroll to (notification deep link). */
  readonly highlightId = input<string | undefined>(undefined);

  protected readonly comments = this.commentsApi.forChapterResource(this.chapterId);
  protected readonly replyTo = signal<ChapterComment | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly canWrite = computed(() => this.auth.can('COMMENT_WRITE'));
  protected readonly canUpvote = computed(() => this.auth.can('COMMENT_UPVOTE'));
  private readonly document = inject(DOCUMENT);
  private scrolledTo: string | null = null;

  constructor() {
    // Once the linked comment is rendered, bring it into view (once per link).
    afterRenderEffect(() => {
      const id = this.highlightId();
      const loaded = this.comments.hasValue() ? this.comments.value() : [];
      if (!id || id === this.scrolledTo || !loaded.some((c) => c.id === id)) {
        return;
      }
      this.scrolledTo = id;
      this.document.getElementById(`comment-${id}`)?.scrollIntoView?.({ block: 'center' });
    });
  }

  protected readonly model = signal<CommentModel>({ content: '', pageReference: null, isSpoiler: false });
  protected readonly commentForm = form(this.model, (path) => {
    required(path.content, { message: 'Write something before posting' });
    maxLength(path.content, COMMENT_MAX_LENGTH, { message: `Comments are limited to ${COMMENT_MAX_LENGTH} characters` });
    min(path.pageReference, 1, { message: 'Page must be 1 or more' });
  });

  protected errors(field: AnyField): string[] {
    return visibleErrors(field);
  }

  protected startReply(comment: ChapterComment): void {
    this.replyTo.set(comment);
  }

  protected cancelReply(): void {
    this.replyTo.set(null);
  }

  protected async upvote(commentId: string): Promise<void> {
    if (!this.canUpvote()) {
      return;
    }
    try {
      // The server counts one vote per user and returns the authoritative total.
      const result = await firstValueFrom(this.commentsApi.upvote(commentId));
      this.comments.update((list) => list.map((c) => (c.id === commentId ? { ...c, upvotes: result.upvotes } : c)));
    } catch {
      // Keep the UI unchanged; a failed upvote is not worth an error banner.
    }
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitError.set(null);
    await submit(this.commentForm, async (f) => {
      this.submitting.set(true);
      try {
        const { content, pageReference, isSpoiler } = f().value();
        const parent = this.replyTo();
        const created = await firstValueFrom(
          this.commentsApi.post(this.chapterId(), {
            content,
            isSpoiler,
            parentId: parent?.id ?? null,
            pageReference: parent ? null : pageReference
          })
        );
        this.comments.update((list) => insertInThread(list, created));
        this.model.set({ content: '', pageReference: null, isSpoiler: false });
        this.replyTo.set(null);
      } catch (error) {
        this.submitError.set(apiErrorMessage(error, 'Could not post your comment'));
      } finally {
        this.submitting.set(false);
      }
    });
  }
}
