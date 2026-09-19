import { Component, computed, input } from '@angular/core';
import { AnyField, visibleErrors } from './form-errors';

/**
 * A field's validation messages, once the user has interacted with it (or the form was submitted). Give it the id
 * the input's `aria-describedby` points to:
 *
 * ```html
 * <input id="email" [formField]="form.email" [appAriaInvalid]="form.email" aria-describedby="email-error" />
 * <app-field-errors id="email-error" [field]="form.email" />
 * ```
 */
@Component({
  selector: 'app-field-errors',
  template: `
    @for (message of messages(); track $index) {
      <span class="field-error">{{ message }}</span>
    }
  `,
  host: { class: 'field-errors' }
})
export class FieldErrors {
  readonly field = input.required<AnyField>();

  protected readonly messages = computed(() => visibleErrors(this.field()));
}
