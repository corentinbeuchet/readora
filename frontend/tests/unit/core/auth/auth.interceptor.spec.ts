import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from '@app/core/auth/auth.interceptor';
import { AuthStore } from '@app/core/auth/auth-store';
import { API_BASE_URL } from '@app/core/config/urls';
import { mockAuthResponse } from './auth-fixtures';
import { API, fail, ok } from '../../test-utils';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => backend.verify());

  async function loginAs(token: string): Promise<void> {
    const login = firstValueFrom(store.login({ email: 'a@b.io', password: 'Sup3rSecret!' }));
    backend.expectOne(`${API}/auth/login`).flush(mockAuthResponse({ accessToken: token }));
    await login;
  }

  it('does not touch non-API requests', () => {
    http.get('https://cdn.readora.com/p1.webp').subscribe();
    const req = backend.expectOne('https://cdn.readora.com/p1.webp');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('attaches the bearer token to API requests and withCredentials to /auth/*', async () => {
    await loginAs('jwt-1');

    http.get(`${API}/profile`).subscribe();
    const profile = backend.expectOne(`${API}/profile`);
    expect(profile.request.headers.get('Authorization')).toBe('Bearer jwt-1');
    expect(profile.request.withCredentials).toBe(false);
    profile.flush(ok({}));

    http.get(`${API}/auth/me`).subscribe();
    const me = backend.expectOne(`${API}/auth/me`);
    expect(me.request.withCredentials).toBe(true);
    me.flush(ok({}));
  });

  it('on 401 refreshes once and retries with the new token', async () => {
    await loginAs('jwt-old');

    const result = firstValueFrom(http.get(`${API}/bookmarks`));
    backend.expectOne(`${API}/bookmarks`).flush(fail('expired'), { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush(mockAuthResponse({ accessToken: 'jwt-new' }));

    const retried = backend.expectOne(`${API}/bookmarks`);
    expect(retried.request.headers.get('Authorization')).toBe('Bearer jwt-new');
    retried.flush(ok([]));

    expect(await result).toEqual(ok([]));
    expect(store.accessToken()).toBe('jwt-new');
  });

  it('logs out when the refresh fails after a 401 (no infinite loop)', async () => {
    await loginAs('jwt-old');

    const result = firstValueFrom(http.get(`${API}/bookmarks`));
    backend.expectOne(`${API}/bookmarks`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    backend.expectNone(`${API}/bookmarks`);
    expect(store.isAuthenticated()).toBe(false);
  });

  it.each([404, 500])('keeps the session when the retried request fails with %i', async (status) => {
    await loginAs('jwt-old');

    const result = firstValueFrom(http.get(`${API}/bookmarks`));
    backend.expectOne(`${API}/bookmarks`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API}/auth/refresh`).flush(mockAuthResponse({ accessToken: 'jwt-new' }));
    backend.expectOne(`${API}/bookmarks`).flush(null, { status, statusText: 'Failure' });

    await expect(result).rejects.toMatchObject({ status });
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('jwt-new');
  });

  it('clears the session when the refresh is rejected with 403', async () => {
    await loginAs('jwt-old');

    const result = firstValueFrom(http.get(`${API}/bookmarks`));
    backend.expectOne(`${API}/bookmarks`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API}/auth/refresh`).flush(null, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('keeps the session when the refresh fails with a network error', async () => {
    await loginAs('jwt-old');

    const result = firstValueFrom(http.get(`${API}/bookmarks`));
    backend.expectOne(`${API}/bookmarks`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API}/auth/refresh`).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    backend.expectNone(`${API}/bookmarks`);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('jwt-old');
  });

  it('does not try to refresh when the failing request is /auth/login itself', async () => {
    const result = firstValueFrom(http.post(`${API}/auth/login`, {}));
    backend.expectOne(`${API}/auth/login`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    backend.expectNone(`${API}/auth/refresh`);
  });

  it('passes 403 through untouched', async () => {
    await loginAs('jwt-1');
    const result = firstValueFrom(http.get(`${API}/bookmarks`));
    backend.expectOne(`${API}/bookmarks`).flush(null, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toMatchObject({ status: 403 });
    backend.expectNone(`${API}/auth/refresh`);
    expect(store.isAuthenticated()).toBe(true);
  });
});

describe('authInterceptor with another API_BASE_URL', () => {
  it('treats the configured base URL as the API (and the default one as foreign)', () => {
    const base = 'https://api.example.test/v9';
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: base }]
    });
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);

    http.get(`${base}/auth/me`).subscribe();
    backend.expectOne(`${base}/auth/me`).flush({});
    http.get(`${API}/auth/me`).subscribe();
    const foreign = backend.expectOne(`${API}/auth/me`);
    expect(foreign.request.withCredentials).toBe(false);
    foreign.flush({});
    backend.verify();
  });
});
