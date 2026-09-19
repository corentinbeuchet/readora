import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '@app/app.routes';
import { AuthStore } from '@app/core/auth/auth-store';
import { Permission } from '@app/core/models/readora.models';
import { mockUser, signIn } from './core/auth/auth-fixtures';
import { provideHttpTesting } from './test-utils';

/** The real route table with its guards: where a URL actually lands. */
describe('guarded routes (real router)', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes, withComponentInputBinding()), ...provideHttpTesting()] });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  /**
   * The page a test lands on starts loading its data; these tests are about where navigation ends, so those reads
   * are answered 404 without being asserted. Only GETs: an unexpected write still fails `verify()`.
   */
  function discardPageLoads(): void {
    http.match((request) => request.method === 'GET').forEach((request) => request.flush(null, { status: 404, statusText: 'Not Found' }));
  }

  afterEach(() => {
    discardPageLoads();
    http.verify();
  });

  async function signInWith(permissions: Permission[]): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions }));
  }

  it.each(['/upload', '/moderation', '/profile', '/scanlation'])('sends an anonymous visitor from %s to login with a returnUrl', async (url) => {
    await harness.navigateByUrl(url);
    expect(router.url).toBe(`/login?returnUrl=${encodeURIComponent(url)}`);
  });

  it.each([
    ['/upload', 'WORK_CREATE'],
    ['/moderation', 'COMMENT_MODERATE']
  ])('sends a reader without the permission from %s to /forbidden', async (url) => {
    await signInWith(['LIBRARY_USE']);
    await harness.navigateByUrl(url);
    expect(router.url).toBe(`/forbidden?from=${encodeURIComponent(url)}`);
  });

  it.each([
    ['/upload', 'WORK_CREATE'],
    ['/moderation', 'COMMENT_MODERATE']
  ] as [string, Permission][])('lets a user with the permission open %s', async (url, permission) => {
    await signInWith([permission]);
    await harness.navigateByUrl(url);
    expect(router.url).toBe(url);
  });

  it('sends a signed-in user from /login to their profile', async () => {
    await signInWith([]);
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/profile');
  });
});
