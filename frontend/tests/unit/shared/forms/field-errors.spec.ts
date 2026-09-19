import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
  let fixture: ComponentFixture<Host>;

  it('stay quiet until the user touches the field, then show its errors', async () => {
    givenARequiredTitleField();

    thenTheErrorsUseTheFieldErrorsStyle();
    thenISeeNoError();
    thenTheFieldIsNotMarkedInvalid();

    whenILeaveTheFieldEmpty();

    thenISeeTheError('Give it a title');
    thenTheFieldIsMarkedInvalid();

    whenIType('Solo Leveling');

    thenISeeNoError();
    thenTheFieldIsNotMarkedInvalid();
  });

  function givenARequiredTitleField(): void {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  }

  function whenILeaveTheFieldEmpty(): void {
    input().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function whenIType(text: string): void {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function thenTheErrorsUseTheFieldErrorsStyle(): void {
    expect(errors().classList).toContain('field-errors');
  }

  function thenISeeTheError(message: string): void {
    expect(errors().textContent?.trim()).toBe(message);
  }

  function thenISeeNoError(): void {
    expect(errors().textContent?.trim()).toBe('');
  }

  function thenTheFieldIsMarkedInvalid(): void {
    expect(input().getAttribute('aria-invalid')).toBe('true');
  }

  function thenTheFieldIsNotMarkedInvalid(): void {
    expect(input().getAttribute('aria-invalid')).toBe('false');
  }

  function input(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#title')!;
  }

  function errors(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#title-error')!;
  }
});
