import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { AuthStore, SESSION_HINT_KEY } from '@app/core/auth/auth-store';
import { SESSION_RESTORE_TIMEOUT_MS, restoreSessionOnBrowser } from '@app/core/auth/session-restore';
import { mockAuthResponse } from './auth-fixtures';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { API, MemoryStorage, provideHttpTesting } from '../../test-utils';

const REFRESH = `${API}/auth/refresh`;

describe('restoreSessionOnBrowser (app initializer)', () => {
  let http: HttpTestingController;
  let store: AuthStore;

  /** `signedInBefore`: this browser signed in earlier, so it may hold a refresh cookie. */
  function setup(platform: 'browser' | 'server', signedInBefore = true): void {
    const storage = new MemoryStorage();
    if (signedInBefore) storage.write(SESSION_HINT_KEY, true);
    TestBed.configureTestingModule({
      providers: [...provideHttpTesting(), { provide: PLATFORM_ID, useValue: platform }, { provide: BrowserStorage, useValue: storage }]
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  }

  const run = (): Promise<unknown> => TestBed.runInInjectionContext(() => restoreSessionOnBrowser());

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('does nothing on the server / during prerender', async () => {
    setup('server');
    await run();
    http.expectNone(REFRESH);
    expect(store.isAuthenticated()).toBe(false);
  });

  it('restores the session from the refresh cookie in the browser', async () => {
    setup('browser');
    const done = run();
    http.expectOne(REFRESH).flush(mockAuthResponse({ accessToken: 'jwt-restored' }));
    await done;
    expect(store.accessToken()).toBe('jwt-restored');
    expect(store.restoring()).toBe(false);
  });

  it('skips the refresh call for a browser that never signed in (keeps the auth rate limit for real reloads)', async () => {
    setup('browser', false);
    await run();
    http.expectNone(REFRESH);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.restoring()).toBe(false);
  });

  it('does not block bootstrap when the API hangs', async () => {
    setup('browser');
    vi.useFakeTimers();
    let settled = false;
    const done = run().then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(SESSION_RESTORE_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(settled).toBe(true);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.restoring()).toBe(false);

    // A late answer still signs the user in.
    http.expectOne(REFRESH).flush(mockAuthResponse({ accessToken: 'jwt-late' }));
    expect(store.accessToken()).toBe('jwt-late');
  });
});
