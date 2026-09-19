import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { RatingsApi } from '@app/core/api/ratings-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { WorkReview } from '@app/core/models/readora.models';
import { asyncAction } from '@app/core/utils/async-action';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';

const REVIEW_MAX = 2000;

interface ReviewModel {
  liked: string;
  disliked: string;
  verdict: string;
}

/** Rating summary, my 1–10 rating, my review and the community's reviews of a series (US-09). */
@Component({
  selector: 'app-work-ratings',
  imports: [FieldErrors, AriaInvalidDirective, FormField, HasPermissionDirective],
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
  /** My rating and review, only for readers who can rate. */
  private readonly mine = this.api.mineResource(
    this.workId,
    computed(() => this.auth.can('RATE_WORK'))
  );
  protected readonly myScore = computed(() => (this.mine.hasValue() ? (this.mine.value()?.score ?? null) : null));
  protected readonly hasReview = computed(() => (this.mine.hasValue() ? !!this.mine.value()?.verdict : false));
  /** Rating, review and helpful votes. */
  protected readonly action = asyncAction();
  protected readonly reviewOpen = signal(false);
  protected readonly myUserId = computed(() => this.auth.user()?.id ?? null);
  /** Series whose review the form was last filled from. */
  private seededFor: string | null = null;

  protected readonly reviewModel = signal<ReviewModel>({ liked: '', disliked: '', verdict: '' });
  protected readonly reviewForm = form(this.reviewModel, (path) => {
    required(path.verdict, { message: 'Write a short verdict' });
    maxLength(path.verdict, REVIEW_MAX);
    maxLength(path.liked, REVIEW_MAX);
    maxLength(path.disliked, REVIEW_MAX);
  });

  constructor() {
    // Fill the review form from my saved review. Like profile-form: a reload of the same series (after rating)
    // never overwrites what I'm typing; only a pristine form, or another series, is re-filled.
    effect(() => {
      const mine = this.mine.hasValue() ? this.mine.value() : undefined;
      const workId = this.workId();
      untracked(() => {
        if (mine === undefined || (workId === this.seededFor && this.reviewForm().dirty())) {
          return;
        }
        this.seededFor = workId;
        this.reviewForm().reset({ liked: mine?.liked ?? '', disliked: mine?.disliked ?? '', verdict: mine?.verdict ?? '' });
      });
    });
  }

  protected async rate(score: number): Promise<void> {
    await this.action.run(async () => {
      const saved = await firstValueFrom(this.api.rate(this.workId(), score));
      this.mine.set(saved);
      this.summary.reload();
    });
  }

  protected async sendReview(event: Event): Promise<void> {
    event.preventDefault();
    const score = this.myScore();
    if (score === null) {
      this.action.fail('Rate the series before writing a review.');
      return;
    }
    await submit(this.reviewForm, async (f) => {
      const { liked, disliked, verdict } = f().value();
      await this.action.run(async () => {
        const saved = await firstValueFrom(this.api.review(this.workId(), { score, liked: liked || undefined, disliked: disliked || undefined, verdict }));
        this.mine.set(saved);
        this.reviewOpen.set(false);
        this.reviews.reload();
      });
    });
  }

  protected async markHelpful(review: WorkReview): Promise<void> {
    await this.action.run(async () => {
      const helpfulVotes = await firstValueFrom(this.api.markHelpful(review.id));
      this.reviews.update((all) => all.map((r) => (r.id === review.id ? { ...r, helpfulVotes } : r)));
    });
  }
}
