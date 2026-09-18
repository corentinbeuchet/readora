import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { RatingsApi } from '@app/core/api/ratings-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { WorkReview } from '@app/core/models/readora.models';
import { AnyField, visibleErrors } from '@app/features/auth/auth-form.utils';

const REVIEW_MAX = 2000;

interface ReviewModel {
  liked: string;
  disliked: string;
  verdict: string;
}

/** Rating summary, my 1–10 rating, my review and the community's reviews of a series (US-09). */
@Component({
  selector: 'app-work-ratings',
  imports: [FormField, HasPermissionDirective],
  templateUrl: './work-ratings.html',
  styleUrl: './work-ratings.scss'
})
export class WorkRatings {
  private readonly api = inject(RatingsApi);
  private readonly auth = inject(AuthStore);

  readonly workId = input.required<string>();

  protected readonly scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected readonly summary = this.api.summaryResource(this.workId);
  protected readonly reviews = this.api.reviewsResource(this.workId);
  protected readonly myScore = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reviewOpen = signal(false);
  /** Helpful counts updated locally after a vote. */
  private readonly votes = signal<Record<string, number>>({});
  protected readonly myUserId = computed(() => this.auth.user()?.id ?? null);

  protected readonly reviewModel = signal<ReviewModel>({ liked: '', disliked: '', verdict: '' });
  protected readonly reviewForm = form(this.reviewModel, (path) => {
    required(path.verdict, { message: 'Write a short verdict' });
    maxLength(path.verdict, REVIEW_MAX);
    maxLength(path.liked, REVIEW_MAX);
    maxLength(path.disliked, REVIEW_MAX);
  });

  constructor() {
    // My existing rating and review, for readers who can rate.
    effect(() => {
      const workId = this.workId();
      if (!this.auth.can('RATE_WORK')) {
        return;
      }
      untracked(() => {
        firstValueFrom(this.api.mine(workId))
          .then((mine) => {
            this.myScore.set(mine?.score ?? null);
            if (mine?.verdict) {
              this.reviewModel.set({ liked: mine.liked ?? '', disliked: mine.disliked ?? '', verdict: mine.verdict });
            }
          })
          .catch(() => this.myScore.set(null));
      });
    });
  }

  protected errors(field: AnyField): string[] {
    return visibleErrors(field);
  }

  protected helpfulVotes(review: WorkReview): number {
    return this.votes()[review.id] ?? review.helpfulVotes;
  }

  protected async rate(score: number): Promise<void> {
    await this.run(async () => {
      const saved = await firstValueFrom(this.api.rate(this.workId(), score));
      this.myScore.set(saved.score);
      this.summary.reload();
    });
  }

  protected async sendReview(event: Event): Promise<void> {
    event.preventDefault();
    const score = this.myScore();
    if (score === null) {
      this.error.set('Rate the series before writing a review.');
      return;
    }
    await submit(this.reviewForm, async (f) => {
      const { liked, disliked, verdict } = f().value();
      await this.run(async () => {
        await firstValueFrom(this.api.review(this.workId(), { score, liked: liked || undefined, disliked: disliked || undefined, verdict }));
        this.reviewOpen.set(false);
        this.reviews.reload();
      });
    });
  }

  protected async markHelpful(review: WorkReview): Promise<void> {
    await this.run(async () => {
      const count = await firstValueFrom(this.api.markHelpful(review.id));
      this.votes.update((all) => ({ ...all, [review.id]: count }));
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
