import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '@app/app.routes';
import { Permission } from '@app/core/models/readora.models';
import { givenIAmSignedInWith } from './core/auth/auth-fixtures';
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

  afterEach(() => {
    discardPageLoads();
    http.verify();
  });

  it.each(['/upload', '/moderation', '/profile', '/scanlation'])('sends an anonymous visitor from %s to login with a returnUrl', async (url) => {
    await whenIOpen(url);

    thenIAmOn(`/login?returnUrl=${encodeURIComponent(url)}`);
  });

  it.each([
    ['/upload', 'WORK_CREATE'],
    ['/moderation', 'COMMENT_MODERATE']
  ])('sends a reader without the permission from %s to /forbidden', async (url) => {
    await givenIAmSignedInWith(['LIBRARY_USE']);

    await whenIOpen(url);

    thenIAmOn(`/forbidden?from=${encodeURIComponent(url)}`);
  });

  it.each([
    ['/upload', 'WORK_CREATE'],
    ['/moderation', 'COMMENT_MODERATE']
  ] as [string, Permission][])('lets a user with the permission open %s', async (url, permission) => {
    await givenIAmSignedInWith([permission]);

    await whenIOpen(url);

    thenIAmOn(url);
  });

  it('sends a signed-in user from /login to their profile', async () => {
    await givenIAmSignedInWith([]);

    await whenIOpen('/login');

    thenIAmOn('/profile');
  });

  async function whenIOpen(url: string): Promise<void> {
    await harness.navigateByUrl(url);
  }

  function thenIAmOn(url: string): void {
    expect(router.url).toBe(url);
  }

  /**
   * The page a test lands on starts loading its data; these tests are about where navigation ends, so those reads
   * are answered 404 without being asserted. Only GETs: an unexpected write still fails `verify()`.
   */
  function discardPageLoads(): void {
    http.match((request) => request.method === 'GET').forEach((request) => request.flush(null, { status: 404, statusText: 'Not Found' }));
  }
});
