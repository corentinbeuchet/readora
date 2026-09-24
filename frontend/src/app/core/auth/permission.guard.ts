import { inject } from '@angular/core';
import { CanActivateFn, Data, Router } from '@angular/router';
import { Permission } from '@app/core/models/identity';
import { AuthStore } from './auth-store';

export const PERMISSION_ROUTE_DATA = 'permission';

/** Reads the `permission` (or `permissions`) from route data: of a matched route (guard) or a route config (preloading). */
export function requiredPermissions(route: { readonly data?: Data }): Permission[] {
  const single = route.data?.[PERMISSION_ROUTE_DATA] as Permission | undefined;
  const many = route.data?.['permissions'] as Permission[] | undefined;
  return [...(single ? [single] : []), ...(many ?? [])];
}

/**
 * Route guard: anonymous users go to `/login?returnUrl=…`, authenticated users lacking
 * one of the required permissions go to `/forbidden`.
 *
 * Usage: `{ path: 'moderation', canActivate: [permissionGuard], data: { permission: 'COMMENT_MODERATE' } }`
 */
export const permissionGuard: CanActivateFn = (route, state) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (!store.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  const required = requiredPermissions(route);
  if (required.length === 0 || store.hasAllPermissions(...required)) {
    return true;
  }
  return router.createUrlTree(['/forbidden'], { queryParams: { from: state.url } });
};
