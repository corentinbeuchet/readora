import { Component, inject } from '@angular/core';
import { UploadWizard } from '@app/features/upload/upload-studio-page/upload-wizard';
import { PageGridUploader } from '@app/shared/pages/page-grid-uploader/page-grid-uploader';

/** Step 3: the chapter's pages (images or a ZIP/CBZ archive), in reading order. */
@Component({
  selector: 'app-pages-step',
  imports: [PageGridUploader],
  templateUrl: './pages-step.html',
  styleUrl: './pages-step.scss'
})
export class PagesStep {
  protected readonly wizard = inject(UploadWizard);
}
