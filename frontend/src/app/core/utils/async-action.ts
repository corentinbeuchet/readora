import { Signal, computed, signal } from '@angular/core';
import { apiErrorMessage } from '@app/core/api/api-client';

export interface RunOptions {
  /** What is busy (e.g. the id of the row whose button was pressed); `true` when there is only one action. */
  key?: string | true;
  /** Message when the error carries none of its own (network error, unexpected exception). */
  fallback?: string;
}

/**
 * The busy / error state of a component's writes (save, delete, vote…), in one place instead of a
 * `busy.set(true); error.set(null); try … catch … finally` block per method.
 *
 * ```ts
 * protected readonly action = asyncAction('Could not save. Please try again.');
 * protected save() {
 *   return this.action.run(async () => this.list.set(await firstValueFrom(this.api.save(draft))));
 * }
 * ```
 * Template: `[disabled]="action.busy()"`, per row `action.busyKey() === row.id`, `@if (action.error(); as message)`.
 */
export interface AsyncAction {
  readonly busy: Signal<boolean>;
  /** Key given to the running action, `null` when idle. */
  readonly busyKey: Signal<string | true | null>;
  readonly error: Signal<string | null>;
  /**
   * Runs `work`, clearing the previous error first. A failure is turned into the user message ([apiErrorMessage])
   * and `undefined` is returned; nothing is thrown.
   */
  run<T>(work: () => Promise<T>, options?: RunOptions): Promise<T | undefined>;
  /** Shows a message that doesn't come from a failed call (e.g. client-side validation). */
  fail(message: string): void;
  clearError(): void;
}

export function asyncAction(fallback?: string): AsyncAction {
  const busyKey = signal<string | true | null>(null);
  const error = signal<string | null>(null);
  return {
    busy: computed(() => busyKey() !== null),
    busyKey: busyKey.asReadonly(),
    error: error.asReadonly(),
    async run<T>(work: () => Promise<T>, options: RunOptions = {}): Promise<T | undefined> {
      busyKey.set(options.key ?? true);
      error.set(null);
      try {
        return await work();
      } catch (err) {
        error.set(apiErrorMessage(err, options.fallback ?? fallback));
        return undefined;
      } finally {
        busyKey.set(null);
      }
    },
    fail: (message: string) => error.set(message),
    clearError: () => error.set(null)
  };
}
