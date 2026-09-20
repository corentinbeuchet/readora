import { Component, computed, inject, input } from '@angular/core';
import { PublishFlow } from '@app/features/upload/upload-studio-page/publish-flow';
import { ExistingSeries, UploadWizard } from '@app/features/upload/upload-studio-page/upload-wizard';
import { WORK_STATUS_LABELS, WORK_TYPE_LABELS } from '@app/core/models/catalog';

/** Step 4: what will be published, then publishing with its progress (retries resume where they stopped). */
@Component({
  selector: 'app-review-step',
  templateUrl: './review-step.html',
  styleUrl: './review-step.scss'
})
export class ReviewStep {
  protected readonly wizard = inject(UploadWizard);
  protected readonly flow = inject(PublishFlow);
  protected readonly typeLabels = WORK_TYPE_LABELS;
  protected readonly statusLabels = WORK_STATUS_LABELS;

  /** The existing series and team to publish into; `null` when the series is created by this publish. */
  readonly existing = input<ExistingSeries | null>(null);

  protected readonly genres = computed(() => this.wizard.draft().genres.join(', ') || $localize`:@@upload.review.noGenres:None`);
}
