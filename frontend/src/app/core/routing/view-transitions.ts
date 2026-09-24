import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

/**
 * `withViewTransitions({ onViewTransitionCreated })`: the page crossfade is for going to another page. When the
 * route stays the same (catalog filters and paging, chapter sort, tabs, the next chapter in the reader), the page is
 * the same component with new data, and a crossfade tens of times per visit only slows it down, so it is skipped.
 */
export function skipSameRouteTransitions({ transition, from, to }: ViewTransitionInfo): void {
  if (leaf(from).routeConfig === leaf(to).routeConfig) {
    transition.skipTransition();
  }
}

function leaf(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let current = snapshot;
  while (current.firstChild) {
    current = current.firstChild;
  }
  return current;
}
