import { Directive, computed, input } from '@angular/core';
import { AnyField, visibleErrors } from './form-errors';

/** `aria-invalid` on a form control: `true` once its field shows errors (same rule as `<app-field-errors>`). */
@Directive({
  selector: '[appAriaInvalid]',
  host: { '[attr.aria-invalid]': 'invalid()' }
})
export class AriaInvalidDirective {
  readonly appAriaInvalid = input.required<AnyField>();

  protected readonly invalid = computed(() => visibleErrors(this.appAriaInvalid()).length > 0);
}
