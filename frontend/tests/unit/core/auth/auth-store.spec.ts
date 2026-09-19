import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthStore, SESSION_HINT_KEY } from '@app/core/auth/auth-store';
import { AuthResponse } from '@app/core/models/readora.models';
import { mockAuthResponse, mockSession, mockUser } from './auth-fixtures';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { API, MemoryStorage, fail, ok, provideHttpTesting } from '../../test-utils';

/** Given/When/Then model for service and store tests (see the frontend-unit-tests skill). */
describe('AuthStore', () => {
  let store: AuthStore;
  let http: HttpTestingController;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({ providers: [...provideHttpTesting(), { provide: BrowserStorage, useValue: storage }] });
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Starts a login and returns its request (to assert on) and a `complete(response)` that answers it. */
  function whenLoggingIn(email = 'reader@readora.test'): { request: TestRequest; complete: (response: AuthResponse) => Promise<AuthResponse> } {
    const login = firstValueFrom(store.login({ email, password: 'Sup3rSecret!' }));
    const request = http.expectOne(`${API}/auth/login`);
    return {
      request,
      complete: (response) => {
        request.flush(ok(response));
        return login;
      }
    };
  }

  /** A signed-in session built from `response` (defaults: a reader with token `jwt-1`). */
  async function givenSignedIn(response: AuthResponse = mockSession()): Promise<void> {
    await whenLoggingIn().complete(response);
  }

  async function whenLoggingOut(): Promise<TestRequest> {
    const logout = firstValueFrom(store.logout());
    const request = http.expectOne(`${API}/auth/logout`);
    request.flush(ok('Logged out'));
    await logout;
    return request;
  }

  it('starts anonymous with no permissions', () => {
    // Given a fresh store (beforeEach)

    // Then
    expect(store.isAuthenticated()).toBe(false);
    expect(store.can('COMMENT_WRITE')).toBe(false);
    expect(store.accessToken()).toBeNull();
  });

  it('login stores the token in memory and exposes permissions', async () => {
    // When
    const login = whenLoggingIn();
    await login.complete(mockSession({ accessToken: 'jwt-1' }));

    // Then
    expect(login.request.request.method).toBe('POST');
    expect(login.request.request.withCredentials).toBe(true);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('jwt-1');
    expect(store.can('COMMENT_WRITE')).toBe(true);
    expect(store.can('CHAPTER_PUBLISH')).toBe(false);
    expect(store.hasAnyPermission('CHAPTER_PUBLISH', 'COMMENT_UPVOTE')).toBe(true);
    expect(store.hasAllPermissions('CHAPTER_PUBLISH', 'COMMENT_UPVOTE')).toBe(false);
    expect(store.isPremium()).toBe(false);
    // The token is never persisted: only the in-memory signal holds it.
    expect(JSON.stringify([...storage.values])).not.toContain('jwt-1');
  });

  it('refresh rotates the token, is shared between concurrent callers and clears the session on 401', async () => {
    // When two callers refresh at once
    const a = firstValueFrom(store.refresh());
    const b = firstValueFrom(store.refresh());
    const requests = http.match(`${API}/auth/refresh`);
    requests[0].flush(mockAuthResponse({ accessToken: 'jwt-2' }));
    await Promise.all([a, b]);

    // Then one request served both
    expect(requests).toHaveLength(1);
    expect(store.accessToken()).toBe('jwt-2');

    // When the refresh cookie is rejected
    const failed = firstValueFrom(store.refresh());
    http.expectOne(`${API}/auth/refresh`).flush(fail('expired'), { status: 401, statusText: 'Unauthorized' });

    // Then
    expect(await failed).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('restoreSession never throws even when the API is unreachable', async () => {
    // Given this browser signed in before
    storage.write(SESSION_HINT_KEY, true);

    // When
    const restore = firstValueFrom(store.restoreSession());
    http.expectOne(`${API}/auth/refresh`).error(new ProgressEvent('error'));

    // Then
    expect(await restore).toBeNull();
    expect(store.restoring()).toBe(false);
  });

  it('premium user exposes plan permissions and isPremium', async () => {
    // When
    await whenLoggingIn('p@readora.test').complete(
      mockSession({
        user: mockUser({
          permissions: ['COMMENT_WRITE', 'COMMENT_UPVOTE', 'BOOKMARK_READ', 'BOOKMARK_WRITE'],
          subscription: { plan: 'PREMIUM', status: 'ACTIVE', active: true, currentPeriodEnd: '2027-01-01T00:00:00Z', planPermissions: ['BOOKMARK_READ', 'BOOKMARK_WRITE'] }
        })
      })
    );

    // Then
    expect(store.isPremium()).toBe(true);
    expect(store.can('BOOKMARK_WRITE')).toBe(true);
  });

  it('logout revokes the cookie server-side and clears the session locally', async () => {
    // Given
    await givenSignedIn();

    // When
    const logout = await whenLoggingOut();

    // Then
    expect(logout.request.withCredentials).toBe(true);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });

  it('remembers that this browser has a session (a flag, never the token) until logout', async () => {
    // Given
    expect(storage.read(SESSION_HINT_KEY)).toBeNull();

    // When
    await givenSignedIn(mockSession({ accessToken: 'jwt-secret' }));

    // Then
    expect(storage.read(SESSION_HINT_KEY)).toBe(true);
    expect(JSON.stringify([...storage.values])).not.toContain('jwt-secret');

    // When
    await whenLoggingOut();

    // Then
    expect(storage.read(SESSION_HINT_KEY)).toBe(false);
  });
});
