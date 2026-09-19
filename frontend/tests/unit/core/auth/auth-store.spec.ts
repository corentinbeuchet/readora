import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthStore, SESSION_HINT_KEY } from '@app/core/auth/auth-store';
import { mockAuthResponse, mockUser } from './auth-fixtures';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { API, MemoryStorage, fail, ok, provideHttpTesting } from '../../test-utils';

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

  it('starts anonymous with no permissions', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.can('COMMENT_WRITE')).toBe(false);
    expect(store.accessToken()).toBeNull();
  });

  it('login stores the token in memory and exposes permissions', async () => {
    const login = firstValueFrom(store.login({ email: 'reader@readora.test', password: 'Sup3rSecret!' }));
    const req = http.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush(mockAuthResponse());
    await login;

    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('jwt-1');
    expect(store.can('COMMENT_WRITE')).toBe(true);
    expect(store.can('CHAPTER_PUBLISH')).toBe(false);
    expect(store.hasAnyPermission('CHAPTER_PUBLISH', 'COMMENT_UPVOTE')).toBe(true);
    expect(store.hasAllPermissions('CHAPTER_PUBLISH', 'COMMENT_UPVOTE')).toBe(false);
    expect(store.isPremium()).toBe(false);
    // Token must never be persisted: only the in-memory signal holds it.
    expect(typeof globalThis.localStorage === 'undefined' || globalThis.localStorage.getItem('accessToken') === null).toBe(true);
  });

  it('refresh rotates the token, is shared between concurrent callers and clears the session on 401', async () => {
    const a = firstValueFrom(store.refresh());
    const b = firstValueFrom(store.refresh());
    const requests = http.match(`${API}/auth/refresh`);
    expect(requests.length).toBe(1);
    requests[0].flush(mockAuthResponse({ accessToken: 'jwt-2' }));
    await Promise.all([a, b]);
    expect(store.accessToken()).toBe('jwt-2');

    const failed = firstValueFrom(store.refresh());
    http.expectOne(`${API}/auth/refresh`).flush(fail('expired'), { status: 401, statusText: 'Unauthorized' });
    expect(await failed).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('restoreSession never throws even when the API is unreachable', async () => {
    storage.write(SESSION_HINT_KEY, true);
    const restore = firstValueFrom(store.restoreSession());
    http.expectOne(`${API}/auth/refresh`).error(new ProgressEvent('error'));
    expect(await restore).toBeNull();
    expect(store.restoring()).toBe(false);
  });

  it('premium user exposes plan permissions and isPremium', async () => {
    const login = firstValueFrom(store.login({ email: 'p@readora.test', password: 'Sup3rSecret!' }));
    http.expectOne(`${API}/auth/login`).flush(
      mockAuthResponse({
        user: mockUser({
          permissions: ['COMMENT_WRITE', 'COMMENT_UPVOTE', 'BOOKMARK_READ', 'BOOKMARK_WRITE'],
          subscription: { plan: 'PREMIUM', status: 'ACTIVE', active: true, currentPeriodEnd: '2027-01-01T00:00:00Z', planPermissions: ['BOOKMARK_READ', 'BOOKMARK_WRITE'] }
        })
      })
    );
    await login;
    expect(store.isPremium()).toBe(true);
    expect(store.can('BOOKMARK_WRITE')).toBe(true);
  });

  it('logout revokes the cookie server-side and clears the session locally', async () => {
    const login = firstValueFrom(store.login({ email: 'reader@readora.test', password: 'Sup3rSecret!' }));
    http.expectOne(`${API}/auth/login`).flush(mockAuthResponse());
    await login;

    const logout = firstValueFrom(store.logout());
    const req = http.expectOne(`${API}/auth/logout`);
    expect(req.request.withCredentials).toBe(true);
    req.flush(ok('Logged out'));
    await logout;
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });

  it('remembers that this browser has a session (a flag, never the token) until logout', async () => {
    expect(storage.read(SESSION_HINT_KEY)).toBeNull();
    const login = firstValueFrom(store.login({ email: 'reader@readora.test', password: 'Sup3rSecret!' }));
    http.expectOne(`${API}/auth/login`).flush(mockAuthResponse({ accessToken: 'jwt-secret' }));
    await login;
    expect(storage.read(SESSION_HINT_KEY)).toBe(true);
    expect(JSON.stringify([...storage.values])).not.toContain('jwt-secret');

    const logout = firstValueFrom(store.logout());
    http.expectOne(`${API}/auth/logout`).flush(ok('Logged out'));
    await logout;
    expect(storage.read(SESSION_HINT_KEY)).toBe(false);
  });
});
