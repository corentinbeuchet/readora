import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
  readonly error = signal<unknown>(new HttpErrorResponse({ status: 503 }));
  retries = 0;
}

describe('LoadError', () => {
  it('offers Retry for a failure, but says "not found" (no Retry) for a 404', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const alert: HTMLElement = fixture.nativeElement.querySelector('app-load-error');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Could not load the team.');
    alert.querySelector('button')!.click();
    expect(fixture.componentInstance.retries).toBe(1);

    fixture.componentInstance.error.set(new HttpErrorResponse({ status: 404 }));
    fixture.detectChanges();
    expect(alert.textContent).toContain('This team could not be found.');
    expect(alert.querySelector('button')).toBeNull();
    expect(alert.querySelector('a')!.getAttribute('href')).toBe('/works');
  });
});
