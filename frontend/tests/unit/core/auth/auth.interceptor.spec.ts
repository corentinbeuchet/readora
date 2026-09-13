import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from '@app/core/auth/auth.interceptor';
import { AuthStore } from '@app/core/auth/auth-store';
import { environment } from '../../../../src/environments/environment';
import { mockAuthResponse } from './auth-fixtures';

const API = environment.apiUrl;

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
    profile.flush({ success: true, data: {}, error: null });

    http.get(`${API}/auth/me`).subscribe();
    const me = backend.expectOne(`${API}/auth/me`);
    expect(me.request.withCredentials).toBe(true);
    me.flush({ success: true, data: {}, error: null });
  });

  it('on 401 refreshes once and retries with the new token', async () => {
    await loginAs('jwt-old');

    const result = firstValueFrom(http.get(`${API}/bookmarks`));
    backend.expectOne(`${API}/bookmarks`).flush({ success: false, data: null, error: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush(mockAuthResponse({ accessToken: 'jwt-new' }));

    const retried = backend.expectOne(`${API}/bookmarks`);
    expect(retried.request.headers.get('Authorization')).toBe('Bearer jwt-new');
    retried.flush({ success: true, data: [], error: null });

    expect(await result).toEqual({ success: true, data: [], error: null });
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
