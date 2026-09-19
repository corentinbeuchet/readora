import { FieldTree, ValidationError } from '@angular/forms/signals';

/** Human-readable message for a Signal Forms validation error. */
export function errorMessage(error: ValidationError): string {
  if (error.message) {
    return error.message;
  }
  switch (error.kind) {
    case 'required':
      return $localize`:@@form.required:This field is required`;
    case 'email':
      return $localize`:@@form.email:Enter a valid email address`;
    case 'minLength':
      return $localize`:@@form.minLength:Must be at least ${(error as { minLength?: number }).minLength ?? ''}:min: characters`;
    case 'maxLength':
      return $localize`:@@form.maxLength:Must be at most ${(error as { maxLength?: number }).maxLength ?? ''}:max: characters`;
    case 'pattern':
      return $localize`:@@form.pattern:Invalid format`;
    default:
      return $localize`:@@form.invalid:Invalid value`;
  }
}

/** Minimal view of a field: `FieldTree<T>` for any `T` (union-typed fields included). */
export type AnyField = () => {
  touched(): boolean;
  dirty(): boolean;
  errors(): readonly ValidationError[];
};

/** Errors of a field, only once the user has interacted with it (or the form was submitted). */
export function visibleErrors(field: AnyField | FieldTree<unknown>): string[] {
  const state = (field as AnyField)();
  if (!state.touched() && !state.dirty()) {
    return [];
  }
  return state.errors().map(errorMessage);
}
