import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { Permission } from '@app/core/models/identity';
import { AuthStore } from './auth-store';

export const PERMISSION_ROUTE_DATA = 'permission';

/** Reads the `permission` (or `permissions`) from route data. */
export function requiredPermissions(route: ActivatedRouteSnapshot): Permission[] {
  const single = route.data[PERMISSION_ROUTE_DATA] as Permission | undefined;
  const many = route.data['permissions'] as Permission[] | undefined;
  return [...(single ? [single] : []), ...(many ?? [])];
}

/**
 * Route guard: anonymous users go to `/login?returnUrl=…`, authenticated users lacking
 * one of the required permissions go to `/forbidden`.
 *
 * Usage: `{ path: 'scanlation/:projectId', canActivate: [permissionGuard], data: { permission: 'PROJECT_VIEW' } }`
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

/** Factory variant when you prefer not to use route `data`. */
export function requirePermission(...permissions: Permission[]): CanActivateFn {
  return (route, state) => {
    const store = inject(AuthStore);
    const router = inject(Router);
    if (!store.isAuthenticated()) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }
    return store.hasAllPermissions(...permissions) ? true : router.createUrlTree(['/forbidden'], { queryParams: { from: state.url } });
  };
}
