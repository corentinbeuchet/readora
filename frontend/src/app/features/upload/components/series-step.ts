import { Component, computed, inject } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { GENRE_PRESETS, UploadWizard } from '@app/features/upload/services/upload-wizard';
import { CoverPicker } from './cover-picker';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';

/** Step 1: the series' details and cover. */
@Component({
  selector: 'app-series-step',
  imports: [FieldErrors, AriaInvalidDirective, FormField, CoverPicker],
  templateUrl: './series-step.html',
  styleUrl: './series-step.scss'
})
export class SeriesStep {
  protected readonly wizard = inject(UploadWizard);
  protected readonly form = this.wizard.form;

  /** Preset genres plus the custom ones added, each with its pressed state (computed once, not per template call). */
  protected readonly genres = computed(() => {
    const selected = new Set(this.wizard.draft().genres);
    const custom = this.wizard.draft().genres.filter((g) => !GENRE_PRESETS.includes(g));
    return [...GENRE_PRESETS, ...custom].map((name) => ({ name, selected: selected.has(name) }));
  });

  protected addGenre(input: HTMLInputElement): void {
    if (this.wizard.addGenre(input.value)) {
      input.value = '';
    }
  }
}
