import { Component, inject } from '@angular/core';
import { SeoService } from '@app/core/seo/seo.service';
import { ChapterStep } from './components/chapter-step';
import { PagesStep } from './components/pages-step';
import { ReviewStep } from './components/review-step';
import { SeriesStep } from './components/series-step';
import { UploadSuccess } from './components/upload-success';
import { WizardSteps } from './components/wizard-steps';
import { PublishFlow } from './services/publish-flow';
import { UploadWizard } from './services/upload-wizard';

export { GENRE_PRESETS, parseChapterNumber } from './services/upload-wizard';
export type { PublishingMode, UploadStep } from './services/upload-wizard';

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
