import { Component, input } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { CONTENT_RATING_LABELS, ContentRating, ORIGINAL_LANGUAGE_LABELS, OriginalLanguage, WorkFactsDraft } from '@app/core/models/catalog';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';

/**
 * The optional facts of a series (US-04) as form fields, for the form that creates a series and the one that edits
 * it. The parent owns the form and applies `WORK_FACTS_SCHEMA` to the sub-tree it passes here.
 */
@Component({
  selector: 'app-work-facts-fields',
  imports: [FormField, FieldErrors, AriaInvalidDirective],
  templateUrl: './work-facts-fields.html',
  styleUrl: './work-facts-fields.scss'
})
export class WorkFactsFields {
  readonly facts = input.required<FieldTree<WorkFactsDraft>>();

  protected readonly languages = (Object.keys(ORIGINAL_LANGUAGE_LABELS) as OriginalLanguage[]).map((code) => ({ code, label: ORIGINAL_LANGUAGE_LABELS[code] }));
  protected readonly ratings = (Object.keys(CONTENT_RATING_LABELS) as ContentRating[]).map((code) => ({ code, label: CONTENT_RATING_LABELS[code] }));
}
