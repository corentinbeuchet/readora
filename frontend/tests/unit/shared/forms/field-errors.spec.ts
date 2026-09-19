import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, required } from '@angular/forms/signals';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';

@Component({
  imports: [FormField, FieldErrors, AriaInvalidDirective],
  template: `
    <label for="title">Title</label>
    <input id="title" [formField]="f.title" [appAriaInvalid]="f.title" aria-describedby="title-error" />
    <app-field-errors id="title-error" [field]="f.title" />
  `
})
class Host {
  readonly model = signal({ title: '' });
  readonly f = form(this.model, (path) => required(path.title, { message: 'Give it a title' }));
}

describe('FieldErrors and appAriaInvalid', () => {
  it('stay quiet until the user touches the field, then show its errors', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#title');
    const errors: HTMLElement = fixture.nativeElement.querySelector('#title-error');
    expect(errors.classList).toContain('field-errors');
    expect(errors.textContent?.trim()).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('false');

    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(errors.textContent?.trim()).toBe('Give it a title');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    input.value = 'Solo Leveling';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(errors.textContent?.trim()).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });
});
