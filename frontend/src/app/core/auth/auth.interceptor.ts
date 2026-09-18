import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from './auth-store';

const API_BASE = environment.apiUrl.replace(/\/+$/, '');
const AUTH_PATH = `${API_BASE}/auth/`;
const REFRESH_URL = `${API_BASE}/auth/refresh`;
const LOGIN_URL = `${API_BASE}/auth/login`;
const REGISTER_URL = `${API_BASE}/auth/register`;
const LOGOUT_URL = `${API_BASE}/auth/logout`;

function isApiRequest(req: HttpRequest<unknown>): boolean {
  return req.url.startsWith(API_BASE);
}

function isCredentialEndpoint(url: string): boolean {
  return url.startsWith(REFRESH_URL) || url.startsWith(LOGIN_URL) || url.startsWith(REGISTER_URL) || url.startsWith(LOGOUT_URL);
}

function withAuth(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  const withCredentials = req.withCredentials || req.url.startsWith(AUTH_PATH);
  if (token && !req.headers.has('Authorization')) {
    return req.clone({ withCredentials, setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return withCredentials === req.withCredentials ? req : req.clone({ withCredentials });
}

/**
 * Attaches the bearer token to API calls, sends the refresh cookie on `/auth/*`, and on a 401
 * tries **one** refresh followed by a retry.
 *
 * Only the refresh itself is guarded: `AuthStore.refresh()` clears the session when the refresh
 * cookie is rejected (401/403) and resolves `null`; any other refresh failure (network, 5xx) keeps
 * the session and surfaces the original 401. Errors from the *retried* request (404, 500, …)
 * propagate untouched and never log the user out.
 */
export const authInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn) => {
  if (!isApiRequest(req)) {
    return next(req);
  }

  const store = inject(AuthStore);
  const authedReq = withAuth(req, store.accessToken());

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!isUnauthorized || isCredentialEndpoint(req.url)) {
        return throwError(() => error);
      }

      const refreshed = store.refresh().pipe(catchError(() => of(null)));
      return refreshed.pipe(
        switchMap((session) => (session ? next(withAuth(req, session.accessToken)) : throwError(() => error)))
      );
    })
  );
};
