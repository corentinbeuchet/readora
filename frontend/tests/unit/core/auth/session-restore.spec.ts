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
  let bootstrap: Promise<unknown>;
  let bootstrapFinished: boolean;

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('does nothing on the server / during prerender', async () => {
    givenTheAppRunsOn('server', { signedInBefore: true });

    await whenTheAppBootstraps();

    thenNoRefreshWasSent();
    thenIAmAnonymous();
  });

  it('restores the session from the refresh cookie in the browser', async () => {
    givenTheAppRunsOn('browser', { signedInBefore: true });

    await whenTheAppBootstrapsAndTheRefreshGivesTheToken('jwt-restored');

    thenMyTokenIs('jwt-restored');
    thenTheStoreIsNotRestoring();
  });

  it('skips the refresh call for a browser that never signed in (keeps the auth rate limit for real reloads)', async () => {
    givenTheAppRunsOn('browser', { signedInBefore: false });

    await whenTheAppBootstraps();

    thenNoRefreshWasSent();
    thenIAmAnonymous();
    thenTheStoreIsNotRestoring();
  });

  it('does not block bootstrap when the API hangs', async () => {
    givenTheAppRunsOn('browser', { signedInBefore: true });
    givenTheClockIsFake();

    whenTheAppStartsBootstrapping();
    await whenTimePasses(SESSION_RESTORE_TIMEOUT_MS - 1);

    thenTheBootstrapIsStillWaiting();

    await whenTimePasses(1);

    await thenTheBootstrapHasFinished();
    thenIAmAnonymous();
    thenTheStoreIsNotRestoring();

    whenTheRefreshFinallyGivesTheToken('jwt-late');

    thenMyTokenIs('jwt-late');
  });

  /** `signedInBefore`: this browser signed in earlier, so it may hold a refresh cookie. */
  function givenTheAppRunsOn(platform: 'browser' | 'server', history: { signedInBefore: boolean }): void {
    const storage = new MemoryStorage();
    if (history.signedInBefore) storage.write(SESSION_HINT_KEY, true);
    TestBed.configureTestingModule({
      providers: [...provideHttpTesting(), { provide: PLATFORM_ID, useValue: platform }, { provide: BrowserStorage, useValue: storage }]
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  }

  function givenTheClockIsFake(): void {
    vi.useFakeTimers();
  }

  async function whenTheAppBootstraps(): Promise<void> {
    await TestBed.runInInjectionContext(() => restoreSessionOnBrowser());
  }

  async function whenTheAppBootstrapsAndTheRefreshGivesTheToken(token: string): Promise<void> {
    const done = TestBed.runInInjectionContext(() => restoreSessionOnBrowser());
    http.expectOne(REFRESH).flush(mockAuthResponse({ accessToken: token }));
    await done;
  }

  function whenTheAppStartsBootstrapping(): void {
    bootstrapFinished = false;
    bootstrap = TestBed.runInInjectionContext(() => restoreSessionOnBrowser()).then(() => (bootstrapFinished = true));
  }

  async function whenTimePasses(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
  }

  function whenTheRefreshFinallyGivesTheToken(token: string): void {
    http.expectOne(REFRESH).flush(mockAuthResponse({ accessToken: token }));
  }

  function thenNoRefreshWasSent(): void {
    http.expectNone(REFRESH);
  }

  function thenIAmAnonymous(): void {
    expect(store.isAuthenticated()).toBe(false);
  }

  function thenMyTokenIs(token: string): void {
    expect(store.accessToken()).toBe(token);
  }

  function thenTheStoreIsNotRestoring(): void {
    expect(store.restoring()).toBe(false);
  }

  function thenTheBootstrapIsStillWaiting(): void {
    expect(bootstrapFinished).toBe(false);
  }

  async function thenTheBootstrapHasFinished(): Promise<void> {
    await bootstrap;
    expect(bootstrapFinished).toBe(true);
  }
});
