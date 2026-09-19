import { Component, inject } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { AnyField, visibleErrors } from '@app/features/auth/auth-form.utils';
import { UploadWizard } from '../services/upload-wizard';

/** Step 2: the chapter's number and title, and how it is published (directly or through the scanlation team). */
@Component({
  selector: 'app-chapter-step',
  imports: [FormField],
  templateUrl: './chapter-step.html',
  styleUrl: './chapter-step.scss'
})
export class ChapterStep {
  protected readonly wizard = inject(UploadWizard);
  protected readonly form = this.wizard.form;

  protected errors(field: AnyField): string[] {
    return visibleErrors(field);
  }
}
