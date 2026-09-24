import { ActivatedRouteSnapshot, Route, ViewTransitionInfo } from '@angular/router';
import { skipSameRouteTransitions } from '@app/core/routing/view-transitions';

const WORKS: Route = { path: 'works' };
const SERIES: Route = { path: 'works/:workId' };

describe('skipSameRouteTransitions', () => {
  let skipped: boolean;

  beforeEach(() => {
    skipped = false;
  });

  it('keeps the crossfade when going to another page', () => {
    whenTheRouterNavigates(WORKS, SERIES);

    thenTheCrossfadeIsKept();
  });

  it('skips it when only the data of the same page changes (filters, paging, the next chapter)', () => {
    whenTheRouterNavigates(WORKS, WORKS);

    thenTheCrossfadeIsSkipped();
  });

  function whenTheRouterNavigates(from: Route, to: Route): void {
    const transition = { skipTransition: () => (skipped = true) } as unknown as ViewTransition;
    skipSameRouteTransitions({ transition, from: rootOf(from), to: rootOf(to) } as ViewTransitionInfo);
  }

  function thenTheCrossfadeIsKept(): void {
    expect(skipped).toBe(false);
  }

  function thenTheCrossfadeIsSkipped(): void {
    expect(skipped).toBe(true);
  }

  /** The router hands over the root snapshot: the page's route is its deepest child. */
  function rootOf(page: Route): ActivatedRouteSnapshot {
    const leaf = { routeConfig: page, firstChild: null };
    return { routeConfig: null, firstChild: leaf } as unknown as ActivatedRouteSnapshot;
  }
});
