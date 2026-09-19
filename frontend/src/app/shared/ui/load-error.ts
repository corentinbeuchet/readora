import { Component, computed, input, output } from '@angular/core';
import { isNotFoundError } from '@app/core/api/api-client';

/**
 * The error state of a resource: the message (projected) and a Retry button. Given the resource's `error`, a 404
 * shows `notFound` instead, without Retry (retrying a missing series or list changes nothing).
 *
 * ```html
 * } @else if (team.error()) {
 *   <app-load-error [error]="team.error()" notFound="This team could not be found." (retry)="team.reload()">
 *     Could not load the team.
 *   </app-load-error>
 * }
 * ```
 * Extra links go in an element marked `actions`: `<a actions routerLink="/works">Browse the catalog</a>`.
 */
@Component({
  selector: 'app-load-error',
  template: `
    @if (isNotFound()) {
      {{ notFound() }}
    } @else {
      <ng-content />
      <button type="button" class="btn btn-link" (click)="retry.emit()" i18n="@@loadError.retry">Retry</button>
    }
    <ng-content select="[actions]" />
  `,
  host: { class: 'form-error load-error', role: 'alert' }
})
export class LoadError {
  readonly error = input<unknown>();
  /** Message for a 404; without it a 404 is treated like any other failure. */
  readonly notFound = input<string>();
  readonly retry = output();

  protected readonly isNotFound = computed(() => !!this.notFound() && isNotFoundError(this.error()));
}
