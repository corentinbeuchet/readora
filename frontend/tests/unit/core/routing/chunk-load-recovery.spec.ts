import { TestBed } from '@angular/core/testing';
import { NavigationError } from '@angular/router';
import { isChunkLoadFailure, recoverFromChunkLoadFailure } from '@app/core/routing/chunk-load-recovery';

describe('chunk load recovery', () => {
  const failure = (url: string, error: unknown) => new NavigationError(1, url, error);

  beforeEach(() => sessionStorage.clear());

  it('recognises failed lazy-chunk loads, and nothing else', () => {
    expect(isChunkLoadFailure(new TypeError('Failed to fetch dynamically imported module: https://readora.com/chunk-ABC.js'))).toBe(true);
    expect(isChunkLoadFailure(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadFailure(new Error('Cannot match any routes'))).toBe(false);
  });

  it('reloads the target page once after a failed chunk load', () => {
    const reload = vi.fn();
    const run = (event: NavigationError) => TestBed.runInInjectionContext(() => recoverFromChunkLoadFailure(event, reload));

    run(failure('/works/w-1', new TypeError('Failed to fetch dynamically imported module: /chunk-X.js')));
    expect(reload).toHaveBeenCalledWith('/works/w-1');

    run(failure('/works/w-1', new TypeError('Failed to fetch dynamically imported module: /chunk-X.js')));
    expect(reload).toHaveBeenCalledTimes(1);

    run(failure('/lists', new Error('Resolver failed')));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
