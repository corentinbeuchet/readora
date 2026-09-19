import { Component, inject } from '@angular/core';
import { SeoService } from '@app/core/seo/seo.service';
import { ChapterStep } from './chapter-step/chapter-step';
import { PagesStep } from './pages-step/pages-step';
import { ReviewStep } from './review-step/review-step';
import { SeriesStep } from './series-step/series-step';
import { UploadSuccess } from './upload-success/upload-success';
import { WizardSteps } from './wizard-steps/wizard-steps';
import { PublishFlow } from './publish-flow';
import { UploadWizard } from './upload-wizard';

export { GENRE_PRESETS, parseChapterNumber } from './upload-wizard';
export type { PublishingMode, UploadStep } from './upload-wizard';

/**
 * Upload studio (`/upload`): a wizard to create a series and publish its first chapter, directly or through the
 * scanlation team. The draft and the publish flow are provided here, so each visit starts with an empty wizard.
 */
@Component({
  selector: 'app-upload-studio-page',
  imports: [WizardSteps, SeriesStep, ChapterStep, PagesStep, ReviewStep, UploadSuccess],
  templateUrl: './upload-studio-page.html',
  styleUrl: './upload-studio-page.scss',
  providers: [UploadWizard, PublishFlow]
})
export class UploadStudioPage {
  protected readonly wizard = inject(UploadWizard);

  constructor() {
    inject(SeoService).update({
      title: 'Upload Studio — Readora',
      description: 'Create manga series, upload chapter pages, and publish directly or via scanlation pipeline.',
      path: '/upload'
    });
  }
}
