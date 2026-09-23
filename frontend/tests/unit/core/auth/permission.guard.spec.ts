import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, guestGuard } from '@app/core/auth/auth.guard';
import { permissionGuard } from '@app/core/auth/permission.guard';
import { givenIAmSignedInWith } from './auth-fixtures';
import { provideHttpTesting } from '../../test-utils';

describe('authGuard / permissionGuard', () => {
  let router: Router;
  let http: HttpTestingController;
  let outcome: boolean | UrlTree;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...provideHttpTesting()] });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('authGuard redirects anonymous users to /login with returnUrl', () => {
    whenTheGuardChecks(authGuard, '/scanlation/p-1');

    thenIAmRedirectedTo('/login?returnUrl=%2Fscanlation%2Fp-1');
  });

  it('authGuard lets authenticated users through; guestGuard sends them to /profile', async () => {
    await givenIAmSignedInWith(['COMMENT_WRITE']);

    whenTheGuardChecks(authGuard, '/scanlation/p-1');

    thenIAmLetThrough();

    whenTheGuardChecks(guestGuard, '/scanlation/p-1');

    thenIAmRedirectedTo('/profile');
  });

  it('permissionGuard redirects anonymous users to login', () => {
    whenTheGuardChecks(permissionGuard, '/scanlation/p-1', { permission: 'PROJECT_VIEW' });

    thenIAmRedirectedToAUrlContaining('/login');
  });

  it('permissionGuard redirects readers lacking the permission to /forbidden', async () => {
    await givenIAmSignedInWith(['COMMENT_WRITE', 'COMMENT_UPVOTE']);

    whenTheGuardChecks(permissionGuard, '/scanlation/p-1', { permission: 'PROJECT_VIEW' });

    thenIAmRedirectedTo('/forbidden?from=%2Fscanlation%2Fp-1');
  });

  it('permissionGuard allows scanlators with PROJECT_VIEW (single and multiple permissions)', async () => {
    await givenIAmSignedInWith(['COMMENT_WRITE', 'PROJECT_VIEW', 'TASK_CLAIM']);

    whenTheGuardChecks(permissionGuard, '/scanlation/p-1', { permission: 'PROJECT_VIEW' });

    thenIAmLetThrough();

    whenTheGuardChecks(permissionGuard, '/scanlation/p-1', { permissions: ['PROJECT_VIEW', 'TASK_CLAIM'] });

    thenIAmLetThrough();

    whenTheGuardChecks(permissionGuard, '/scanlation/p-1', { permissions: ['PROJECT_VIEW', 'CHAPTER_PUBLISH'] });

    thenIAmRedirected();
  });

  /** Runs `guard` for a navigation to `url` whose route carries `data`. */
  function whenTheGuardChecks(guard: CanActivateFn, url: string, data: Record<string, unknown> = {}): void {
    const route = { data } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    outcome = TestBed.runInInjectionContext(() => guard(route, state)) as boolean | UrlTree;
  }

  function thenIAmLetThrough(): void {
    expect(outcome).toBe(true);
  }

  function thenIAmRedirected(): void {
    expect(outcome).toBeInstanceOf(UrlTree);
  }

  function thenIAmRedirectedTo(url: string): void {
    expect(outcome).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(outcome as UrlTree)).toBe(url);
  }

  function thenIAmRedirectedToAUrlContaining(fragment: string): void {
    expect(router.serializeUrl(outcome as UrlTree)).toContain(fragment);
  }
});
