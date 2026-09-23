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
    whenTheGuardChecks(authGuard, '/moderation');

    thenIAmRedirectedTo('/login?returnUrl=%2Fmoderation');
  });

  it('authGuard lets authenticated users through; guestGuard sends them to /profile', async () => {
    await givenIAmSignedInWith(['COMMENT_WRITE']);

    whenTheGuardChecks(authGuard, '/moderation');

    thenIAmLetThrough();

    whenTheGuardChecks(guestGuard, '/moderation');

    thenIAmRedirectedTo('/profile');
  });

  it('permissionGuard redirects anonymous users to login', () => {
    whenTheGuardChecks(permissionGuard, '/moderation', { permission: 'COMMENT_MODERATE' });

    thenIAmRedirectedToAUrlContaining('/login');
  });

  it('permissionGuard redirects readers lacking the permission to /forbidden', async () => {
    await givenIAmSignedInWith(['COMMENT_WRITE', 'COMMENT_UPVOTE']);

    whenTheGuardChecks(permissionGuard, '/moderation', { permission: 'COMMENT_MODERATE' });

    thenIAmRedirectedTo('/forbidden?from=%2Fmoderation');
  });

  it('permissionGuard allows moderators with COMMENT_MODERATE (single and multiple permissions)', async () => {
    await givenIAmSignedInWith(['COMMENT_WRITE', 'COMMENT_MODERATE', 'LIBRARY_USE']);

    whenTheGuardChecks(permissionGuard, '/moderation', { permission: 'COMMENT_MODERATE' });

    thenIAmLetThrough();

    whenTheGuardChecks(permissionGuard, '/moderation', { permissions: ['COMMENT_MODERATE', 'LIBRARY_USE'] });

    thenIAmLetThrough();

    whenTheGuardChecks(permissionGuard, '/moderation', { permissions: ['COMMENT_MODERATE', 'USER_MANAGE'] });

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
