import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { LoadError } from '@app/shared/ui/load-error';

@Component({
  imports: [LoadError],
  template: `
    <app-load-error [error]="error()" notFound="This team could not be found." (retry)="retries = retries + 1">
      Could not load the team.
      <a actions href="/works">Browse the catalog</a>
    </app-load-error>
  `
})
class Host {
  readonly error = signal<unknown>(null);
  retries = 0;
}

describe('LoadError', () => {
  let fixture: ComponentFixture<Host>;

  it('offers Retry for a failure, but says "not found" (no Retry) for a 404', () => {
    givenTheLoadFailedWith(503);

    thenTheErrorIsAnAlert();
    thenISee('Could not load the team.');

    whenIRetry();

    thenARetryWasAsked(1);

    whenTheLoadFailsWith(404);

    thenISee('This team could not be found.');
    thenICannotRetry();
    thenTheExtraLinkGoesTo('/works');
  });

  function givenTheLoadFailedWith(status: number): void {
    fixture = TestBed.createComponent(Host);
    whenTheLoadFailsWith(status);
  }

  function whenTheLoadFailsWith(status: number): void {
    fixture.componentInstance.error.set(new HttpErrorResponse({ status }));
    fixture.detectChanges();
  }

  function whenIRetry(): void {
    alert().querySelector('button')!.click();
  }

  function thenTheErrorIsAnAlert(): void {
    expect(alert().getAttribute('role')).toBe('alert');
  }

  function thenISee(text: string): void {
    expect(alert().textContent).toContain(text);
  }

  function thenARetryWasAsked(times: number): void {
    expect(fixture.componentInstance.retries).toBe(times);
  }

  function thenICannotRetry(): void {
    expect(alert().querySelector('button')).toBeNull();
  }

  function thenTheExtraLinkGoesTo(href: string): void {
    expect(alert().querySelector('a')!.getAttribute('href')).toBe(href);
  }

  function alert(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('app-load-error')!;
  }
});
