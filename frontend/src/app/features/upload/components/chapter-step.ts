import { Component, inject } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { UploadWizard } from '../services/upload-wizard';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';

/** Step 2: the chapter's number and title, and how it is published (directly or through the scanlation team). */
@Component({
  selector: 'app-chapter-step',
  imports: [FieldErrors, AriaInvalidDirective, FormField],
  templateUrl: './chapter-step.html',
  styleUrl: './chapter-step.scss'
})
export class ChapterStep {
  protected readonly wizard = inject(UploadWizard);
  protected readonly form = this.wizard.form;

}
