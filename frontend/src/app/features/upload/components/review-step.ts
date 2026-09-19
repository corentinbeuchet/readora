import { Component, computed, inject } from '@angular/core';
import { PublishFlow } from '../services/publish-flow';
import { UploadWizard } from '../services/upload-wizard';

/** Step 4: what will be published, then publishing with its progress (retries resume where they stopped). */
@Component({
  selector: 'app-review-step',
  templateUrl: './review-step.html',
  styleUrl: './review-step.scss'
})
export class ReviewStep {
  protected readonly wizard = inject(UploadWizard);
  protected readonly flow = inject(PublishFlow);

  protected readonly genres = computed(() => this.wizard.draft().genres.join(', ') || 'None');
}
