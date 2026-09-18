import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type UploadStep = 'manga' | 'chapter' | 'pages' | 'review' | 'success';
type WizardStep = Exclude<UploadStep, 'success'>;

const ORDER: WizardStep[] = ['manga', 'chapter', 'pages', 'review'];

/** Step indicator of the upload wizard; a step is reachable once all previous steps are valid. */
@Component({
  selector: 'app-wizard-steps',
  templateUrl: './wizard-steps.html',
  styleUrl: './wizard-steps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WizardSteps {
  readonly current = input.required<UploadStep>();
  readonly mangaValid = input(false);
  readonly chapterValid = input(false);
  readonly pagesValid = input(false);
  readonly stepSelected = output<WizardStep>();

  protected readonly steps: { key: WizardStep; label: string }[] = [
    { key: 'manga', label: 'Manga Details' },
    { key: 'chapter', label: 'Chapter Setup' },
    { key: 'pages', label: 'Page Uploader' },
    { key: 'review', label: 'Review & Publish' },
  ];

  private valid(step: WizardStep): boolean {
    switch (step) {
      case 'manga':
        return this.mangaValid();
      case 'chapter':
        return this.chapterValid();
      case 'pages':
        return this.pagesValid();
      default:
        return false;
    }
  }

  protected isReachable(step: WizardStep): boolean {
    return ORDER.slice(0, ORDER.indexOf(step)).every((s) => this.valid(s));
  }

  protected isCompleted(step: WizardStep): boolean {
    const current = this.current();
    const currentIndex = current === 'success' ? ORDER.length : ORDER.indexOf(current);
    return step !== 'review' && ORDER.indexOf(step) < currentIndex && this.valid(step);
  }
}
