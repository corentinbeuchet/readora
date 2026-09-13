import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { authGuard, guestGuard } from '@app/core/auth/auth.guard';
import { permissionGuard, requirePermission } from '@app/core/auth/permission.guard';
import { Permission } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';
import { mockAuthResponse, mockUser } from './auth-fixtures';

function routeWith(data: Record<string, unknown>): ActivatedRouteSnapshot {
  return { data } as unknown as ActivatedRouteSnapshot;
}

const state = { url: '/scanlation/p-1' } as RouterStateSnapshot;

describe('authGuard / permissionGuard', () => {
  let store: AuthStore;
  let router: Router;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  });

  async function loginWith(permissions: Permission[]): Promise<void> {
    const login = firstValueFrom(store.login({ email: 'a@b.io', password: 'Sup3rSecret!' }));
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(mockAuthResponse({ user: mockUser({ permissions }) }));
    await login;
  }

  function run(guard: typeof permissionGuard, route: ActivatedRouteSnapshot): boolean | UrlTree {
    return TestBed.runInInjectionContext(() => guard(route, state)) as boolean | UrlTree;
  }

  it('authGuard redirects anonymous users to /login with returnUrl', () => {
    const result = run(authGuard, routeWith({}));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fscanlation%2Fp-1');
  });

  it('authGuard lets authenticated users through; guestGuard sends them to /profile', async () => {
    await loginWith(['COMMENT_WRITE']);
    expect(run(authGuard, routeWith({}))).toBe(true);
    const guest = run(guestGuard, routeWith({}));
    expect(router.serializeUrl(guest as UrlTree)).toBe('/profile');
  });

  it('permissionGuard redirects anonymous users to login', () => {
    const result = run(permissionGuard, routeWith({ permission: 'PROJECT_VIEW' }));
    expect(router.serializeUrl(result as UrlTree)).toContain('/login');
  });

  it('permissionGuard redirects readers lacking the permission to /forbidden', async () => {
    await loginWith(['COMMENT_WRITE', 'COMMENT_UPVOTE']);
    const result = run(permissionGuard, routeWith({ permission: 'PROJECT_VIEW' }));
    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden?from=%2Fscanlation%2Fp-1');
  });

  it('permissionGuard allows scanlators with PROJECT_VIEW (single and multiple permissions)', async () => {
    await loginWith(['COMMENT_WRITE', 'PROJECT_VIEW', 'TASK_CLAIM']);
    expect(run(permissionGuard, routeWith({ permission: 'PROJECT_VIEW' }))).toBe(true);
    expect(run(permissionGuard, routeWith({ permissions: ['PROJECT_VIEW', 'TASK_CLAIM'] }))).toBe(true);
    expect(run(permissionGuard, routeWith({ permissions: ['PROJECT_VIEW', 'CHAPTER_PUBLISH'] }))).toBeInstanceOf(UrlTree);
    expect(run(requirePermission('TASK_CLAIM'), routeWith({}))).toBe(true);
    expect(run(requirePermission('USER_MANAGE'), routeWith({}))).toBeInstanceOf(UrlTree);
  });
});
