import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthStore, SESSION_HINT_KEY } from '@app/core/auth/auth-store';
import { AuthResponse, Permission } from '@app/core/models/identity';
import { mockSession } from './auth-fixtures';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { API, MemoryStorage, fail, ok, provideHttpTesting } from '../../test-utils';

/** Model for service and store tests: given/when/then methods (frontend-unit-tests skill). */
describe('AuthStore', () => {
  let store: AuthStore;
  let http: HttpTestingController;
  let storage: MemoryStorage;
  let lastRequest: TestRequest;
  let refreshes: Promise<AuthResponse | null>[];
  let refreshRequests: TestRequest[];

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({ providers: [...provideHttpTesting(), { provide: BrowserStorage, useValue: storage }] });
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts anonymous with no permissions', () => {
    thenIAmAnonymous();
    thenICannot('COMMENT_WRITE');
  });

  it('login stores the token in memory and exposes permissions', async () => {
    await whenILogIn(mockSession({ accessToken: 'jwt-1' }));

    thenTheLoginWasAPostWithCredentials();
    thenIAmSignedInWithToken('jwt-1');
    thenICan('COMMENT_WRITE');
    thenICannot('COMMENT_MODERATE');
    thenIHaveAnyOf('COMMENT_MODERATE', 'COMMENT_UPVOTE');
    thenIDoNotHaveAllOf('COMMENT_MODERATE', 'COMMENT_UPVOTE');
    thenTheTokenIsNotStored('jwt-1');
  });

  it('refresh rotates the token, is shared between concurrent callers and clears the session on 401', async () => {
    whenTwoCallersRefreshAtOnce();
    await whenTheRefreshAnswers(mockSession({ accessToken: 'jwt-2' }));

    thenOnlyOneRefreshWasSent();
    thenIAmSignedInWithToken('jwt-2');

    const refreshed = await whenTheRefreshCookieIsRejected();

    thenTheRefreshResolvedToNull(refreshed);
    thenIAmAnonymous();
  });

  it('restoreSession never throws even when the API is unreachable', async () => {
    givenThisBrowserSignedInBefore();

    const restored = await whenIRestoreTheSessionAndTheApiIsUnreachable();

    thenTheRefreshResolvedToNull(restored);
    thenTheStoreIsNotRestoring();
  });

  it('logout revokes the cookie server-side and clears the session locally', async () => {
    await givenIAmSignedIn();

    await whenILogOut();

    thenTheLogoutSentTheRefreshCookie();
    thenIAmAnonymous();
  });

  it('remembers that this browser has a session (a flag, never the token) until logout', async () => {
    await whenILogIn(mockSession({ accessToken: 'jwt-secret' }));

    thenThisBrowserHasASessionHint();
    thenTheTokenIsNotStored('jwt-secret');

    await whenILogOut();

    thenThisBrowserHasNoSessionHintAnyMore();
  });

  async function givenIAmSignedIn(session: AuthResponse = mockSession()): Promise<void> {
    await whenILogIn(session);
  }

  function givenThisBrowserSignedInBefore(): void {
    storage.write(SESSION_HINT_KEY, true);
  }

  async function whenILogIn(session: AuthResponse): Promise<void> {
    const login = firstValueFrom(store.login({ email: session.user.email, password: 'Sup3rSecret!' }));
    lastRequest = http.expectOne(`${API}/auth/login`);
    lastRequest.flush(ok(session));
    await login;
  }

  async function whenILogOut(): Promise<void> {
    const logout = firstValueFrom(store.logout());
    lastRequest = http.expectOne(`${API}/auth/logout`);
    lastRequest.flush(ok('Logged out'));
    await logout;
  }

  function whenTwoCallersRefreshAtOnce(): void {
    refreshes = [firstValueFrom(store.refresh()), firstValueFrom(store.refresh())];
  }

  async function whenTheRefreshAnswers(session: AuthResponse): Promise<void> {
    refreshRequests = http.match(`${API}/auth/refresh`);
    refreshRequests.forEach((request) => request.flush(ok(session)));
    await Promise.all(refreshes);
  }

  async function whenTheRefreshCookieIsRejected(): Promise<AuthResponse | null> {
    const refresh = firstValueFrom(store.refresh());
    http.expectOne(`${API}/auth/refresh`).flush(fail('expired'), { status: 401, statusText: 'Unauthorized' });
    return refresh;
  }

  async function whenIRestoreTheSessionAndTheApiIsUnreachable(): Promise<AuthResponse | null> {
    const restore = firstValueFrom(store.restoreSession());
    http.expectOne(`${API}/auth/refresh`).error(new ProgressEvent('error'));
    return restore;
  }

  function thenIAmAnonymous(): void {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
    expect(store.user()).toBeNull();
  }

  function thenIAmSignedInWithToken(token: string): void {
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe(token);
  }

  function thenICan(permission: Permission): void {
    expect(store.can(permission)).toBe(true);
  }

  function thenICannot(permission: Permission): void {
    expect(store.can(permission)).toBe(false);
  }

  function thenIHaveAnyOf(...permissions: Permission[]): void {
    expect(store.hasAnyPermission(...permissions)).toBe(true);
  }

  function thenIDoNotHaveAllOf(...permissions: Permission[]): void {
    expect(store.hasAllPermissions(...permissions)).toBe(false);
  }



  /** The access token lives only in memory: nothing written to browser storage may contain it. */
  function thenTheTokenIsNotStored(token: string): void {
    expect(JSON.stringify([...storage.values])).not.toContain(token);
  }

  function thenTheLoginWasAPostWithCredentials(): void {
    expect(lastRequest.request.method).toBe('POST');
    expect(lastRequest.request.withCredentials).toBe(true);
  }

  function thenTheLogoutSentTheRefreshCookie(): void {
    expect(lastRequest.request.withCredentials).toBe(true);
  }

  function thenOnlyOneRefreshWasSent(): void {
    expect(refreshRequests).toHaveLength(1);
  }

  function thenTheRefreshResolvedToNull(result: AuthResponse | null): void {
    expect(result).toBeNull();
  }

  function thenTheStoreIsNotRestoring(): void {
    expect(store.restoring()).toBe(false);
  }

  function thenThisBrowserHasASessionHint(): void {
    expect(storage.read(SESSION_HINT_KEY)).toBe(true);
  }

  function thenThisBrowserHasNoSessionHintAnyMore(): void {
    expect(storage.read(SESSION_HINT_KEY)).toBe(false);
  }
});
