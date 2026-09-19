import { FieldTree, ValidationError } from '@angular/forms/signals';

/** Human-readable message for a Signal Forms validation error. */
export function errorMessage(error: ValidationError): string {
  if (error.message) {
    return error.message;
  }
  switch (error.kind) {
    case 'required':
      return 'This field is required';
    case 'email':
      return 'Enter a valid email address';
    case 'minLength':
      return `Must be at least ${(error as { minLength?: number }).minLength ?? ''} characters`.trim();
    case 'maxLength':
      return `Must be at most ${(error as { maxLength?: number }).maxLength ?? ''} characters`.trim();
    case 'pattern':
      return 'Invalid format';
    default:
      return 'Invalid value';
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
