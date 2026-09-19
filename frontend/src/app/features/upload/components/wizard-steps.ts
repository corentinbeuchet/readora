import { Component, computed, input, output } from '@angular/core';
import { UploadStep } from '../services/upload-wizard';

export type { UploadStep } from '../services/upload-wizard';
type WizardStep = Exclude<UploadStep, 'success'>;

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'manga', label: 'Manga Details' },
  { key: 'chapter', label: 'Chapter Setup' },
  { key: 'pages', label: 'Page Uploader' },
  { key: 'review', label: 'Review & Publish' }
];

/** Step indicator of the upload wizard; a step is reachable once all previous steps are valid. */
@Component({
  selector: 'app-wizard-steps',
  templateUrl: './wizard-steps.html',
  styleUrl: './wizard-steps.scss'
})
export class WizardSteps {
  readonly current = input.required<UploadStep>();
  readonly mangaValid = input(false);
  readonly chapterValid = input(false);
  readonly pagesValid = input(false);
  readonly stepSelected = output<WizardStep>();

  /** One entry per step with its state (computed once, not per template call). */
  protected readonly steps = computed(() => {
    const valid: Record<WizardStep, boolean> = {
      manga: this.mangaValid(),
      chapter: this.chapterValid(),
      pages: this.pagesValid(),
      review: false
    };
    const current = this.current();
    const currentIndex = current === 'success' ? STEPS.length : STEPS.findIndex((s) => s.key === current);
    return STEPS.map((step, index) => ({
      ...step,
      number: index + 1,
      current: step.key === current,
      reachable: STEPS.slice(0, index).every((s) => valid[s.key]),
      completed: step.key !== 'review' && index < currentIndex && valid[step.key]
    }));
  });
}
