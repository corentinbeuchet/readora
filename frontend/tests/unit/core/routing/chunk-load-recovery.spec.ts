import { TestBed } from '@angular/core/testing';
import { NavigationError } from '@angular/router';
import { isChunkLoadFailure, recoverFromChunkLoadFailure } from '@app/core/routing/chunk-load-recovery';

describe('chunk load recovery', () => {
  let reload: ReturnType<typeof vi.fn<(url: string) => void>>;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn<(url: string) => void>();
  });

  it('recognises failed lazy-chunk loads, and nothing else', () => {
    thenItIsAChunkLoadFailure(new TypeError('Failed to fetch dynamically imported module: https://readora.com/chunk-ABC.js'));
    thenItIsAChunkLoadFailure(new TypeError('Importing a module script failed.'));
    thenItIsNotAChunkLoadFailure(new Error('Cannot match any routes'));
  });

  it('reloads the target page once after a failed chunk load', () => {
    whenTheNavigationFails('/works/w-1', new TypeError('Failed to fetch dynamically imported module: /chunk-X.js'));

    thenThePageWasReloadedAt('/works/w-1');

    whenTheNavigationFails('/works/w-1', new TypeError('Failed to fetch dynamically imported module: /chunk-X.js'));

    thenThePageWasReloadedTimes(1);

    whenTheNavigationFails('/lists', new Error('Resolver failed'));

    thenThePageWasReloadedTimes(1);
  });

  function whenTheNavigationFails(url: string, error: unknown): void {
    TestBed.runInInjectionContext(() => recoverFromChunkLoadFailure(new NavigationError(1, url, error), reload));
  }

  function thenItIsAChunkLoadFailure(error: unknown): void {
    expect(isChunkLoadFailure(error)).toBe(true);
  }

  function thenItIsNotAChunkLoadFailure(error: unknown): void {
    expect(isChunkLoadFailure(error)).toBe(false);
  }

  function thenThePageWasReloadedAt(url: string): void {
    expect(reload).toHaveBeenCalledWith(url);
  }

  function thenThePageWasReloadedTimes(times: number): void {
    expect(reload).toHaveBeenCalledTimes(times);
  }
});
