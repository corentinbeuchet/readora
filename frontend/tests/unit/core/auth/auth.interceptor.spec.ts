import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from '@app/core/auth/auth.interceptor';
import { AuthStore } from '@app/core/auth/auth-store';
import { API_BASE_URL } from '@app/core/config/urls';
import { mockAuthResponse } from './auth-fixtures';
import { API, fail, ok } from '../../test-utils';

/** A response body `TestRequest.flush` accepts. */
type Body = Parameters<TestRequest['flush']>[0];

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let store: AuthStore;
  let lastRequest: TestRequest;
  let refreshRequest: TestRequest;
  let result: Promise<unknown>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => backend.verify());

  it('does not touch non-API requests', () => {
    whenIGet('https://cdn.readora.com/p1.webp', {});

    thenTheRequestHasNoAuthorization();
  });

  it('attaches the bearer token to API requests and withCredentials to /auth/*', async () => {
    await givenIAmSignedInWithToken('jwt-1');

    whenIGet(`${API}/profile`);

    thenTheRequestCarriesTheBearer('jwt-1');
    thenTheRequestIsSentWithoutCredentials();

    whenIGet(`${API}/auth/me`);

    thenTheRequestIsSentWithCredentials();
  });

  it('on 401 refreshes once and retries with the new token', async () => {
    await givenIAmSignedInWithToken('jwt-old');

    whenICallAndTheServerAnswers(`${API}/bookmarks`, 401, fail('expired'));
    whenTheRefreshGivesTheToken('jwt-new');
    whenTheRetryAnswers(`${API}/bookmarks`, 200, ok([]));

    thenTheRefreshWasSentWithCredentials();
    thenTheRequestCarriesTheBearer('jwt-new');
    await thenTheCallerGets(ok([]));
    thenIAmSignedInWithToken('jwt-new');
  });

  it('logs out when the refresh fails after a 401 (no infinite loop)', async () => {
    await givenIAmSignedInWithToken('jwt-old');

    whenICallAndTheServerAnswers(`${API}/bookmarks`, 401);
    whenTheRefreshIsRejectedWith(401);

    await thenTheCallFailsWithAnHttpError();
    thenNoRetryWasSent(`${API}/bookmarks`);
    thenIAmSignedOut();
  });

  it.each([404, 500])('keeps the session when the retried request fails with %i', async (status) => {
    await givenIAmSignedInWithToken('jwt-old');

    whenICallAndTheServerAnswers(`${API}/bookmarks`, 401);
    whenTheRefreshGivesTheToken('jwt-new');
    whenTheRetryAnswers(`${API}/bookmarks`, status);

    await thenTheCallFailsWithStatus(status);
    thenIAmSignedInWithToken('jwt-new');
  });

  it('clears the session when the refresh is rejected with 403', async () => {
    await givenIAmSignedInWithToken('jwt-old');

    whenICallAndTheServerAnswers(`${API}/bookmarks`, 401);
    whenTheRefreshIsRejectedWith(403);

    await thenTheCallFailsWithStatus(401);
    thenIAmSignedOut();
  });

  it('keeps the session when the refresh fails with a network error', async () => {
    await givenIAmSignedInWithToken('jwt-old');

    whenICallAndTheServerAnswers(`${API}/bookmarks`, 401);
    whenTheRefreshHitsANetworkError();

    await thenTheCallFailsWithStatus(401);
    thenNoRetryWasSent(`${API}/bookmarks`);
    thenIAmSignedInWithToken('jwt-old');
  });

  it('does not try to refresh when the failing request is /auth/login itself', async () => {
    whenILogInAndTheServerAnswers(401);

    await thenTheCallFailsWithAnHttpError();
    thenNoRefreshWasSent();
  });

  it('passes 403 through untouched', async () => {
    await givenIAmSignedInWithToken('jwt-1');

    whenICallAndTheServerAnswers(`${API}/bookmarks`, 403);

    await thenTheCallFailsWithStatus(403);
    thenNoRefreshWasSent();
    thenIAmSignedIn();
  });

  async function givenIAmSignedInWithToken(token: string): Promise<void> {
    const login = firstValueFrom(store.login({ email: 'a@b.io', password: 'Sup3rSecret!' }));
    backend.expectOne(`${API}/auth/login`).flush(mockAuthResponse({ accessToken: token }));
    await login;
  }

  function whenIGet(url: string, answer: Body = ok({})): void {
    http.get(url).subscribe();
    lastRequest = backend.expectOne(url);
    lastRequest.flush(answer);
  }

  function whenICallAndTheServerAnswers(url: string, status: number, body: Body = null): void {
    result = firstValueFrom(http.get(url));
    lastRequest = backend.expectOne(url);
    lastRequest.flush(body, { status, statusText: 'Failure' });
  }

  function whenILogInAndTheServerAnswers(status: number): void {
    result = firstValueFrom(http.post(`${API}/auth/login`, {}));
    backend.expectOne(`${API}/auth/login`).flush(null, { status, statusText: 'Failure' });
  }

  function whenTheRefreshGivesTheToken(token: string): void {
    refreshRequest = backend.expectOne(`${API}/auth/refresh`);
    refreshRequest.flush(mockAuthResponse({ accessToken: token }));
  }

  function whenTheRefreshIsRejectedWith(status: number): void {
    refreshRequest = backend.expectOne(`${API}/auth/refresh`);
    refreshRequest.flush(null, { status, statusText: 'Failure' });
  }

  function whenTheRefreshHitsANetworkError(): void {
    refreshRequest = backend.expectOne(`${API}/auth/refresh`);
    refreshRequest.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
  }

  function whenTheRetryAnswers(url: string, status: number, body: Body = null): void {
    lastRequest = backend.expectOne(url);
    lastRequest.flush(body, { status, statusText: status === 200 ? 'OK' : 'Failure' });
  }

  function thenTheRequestHasNoAuthorization(): void {
    expect(lastRequest.request.headers.has('Authorization')).toBe(false);
  }

  function thenTheRequestCarriesTheBearer(token: string): void {
    expect(lastRequest.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
  }

  function thenTheRequestIsSentWithCredentials(): void {
    expect(lastRequest.request.withCredentials).toBe(true);
  }

  function thenTheRequestIsSentWithoutCredentials(): void {
    expect(lastRequest.request.withCredentials).toBe(false);
  }

  function thenTheRefreshWasSentWithCredentials(): void {
    expect(refreshRequest.request.withCredentials).toBe(true);
  }

  async function thenTheCallerGets(body: Body): Promise<void> {
    expect(await result).toEqual(body);
  }

  async function thenTheCallFailsWithAnHttpError(): Promise<void> {
    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
  }

  async function thenTheCallFailsWithStatus(status: number): Promise<void> {
    await expect(result).rejects.toMatchObject({ status });
  }

  function thenNoRetryWasSent(url: string): void {
    backend.expectNone(url);
  }

  function thenNoRefreshWasSent(): void {
    backend.expectNone(`${API}/auth/refresh`);
  }

  function thenIAmSignedIn(): void {
    expect(store.isAuthenticated()).toBe(true);
  }

  function thenIAmSignedInWithToken(token: string): void {
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe(token);
  }

  function thenIAmSignedOut(): void {
    expect(store.isAuthenticated()).toBe(false);
  }
});

describe('authInterceptor with another API_BASE_URL', () => {
  const BASE = 'https://api.example.test/v9';
  let http: HttpClient;
  let backend: HttpTestingController;
  let lastRequest: TestRequest;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: BASE }]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('treats the configured base URL as the API (and the default one as foreign)', () => {
    whenIGet(`${BASE}/auth/me`);

    thenTheRequestIsSentWithCredentials();

    whenIGet(`${API}/auth/me`);

    thenTheRequestIsSentWithoutCredentials();
  });

  function whenIGet(url: string): void {
    http.get(url).subscribe();
    lastRequest = backend.expectOne(url);
    lastRequest.flush({});
  }

  function thenTheRequestIsSentWithCredentials(): void {
    expect(lastRequest.request.withCredentials).toBe(true);
  }

  function thenTheRequestIsSentWithoutCredentials(): void {
    expect(lastRequest.request.withCredentials).toBe(false);
  }
});
