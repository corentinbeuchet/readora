import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '@app/core/config/urls';
import { AuthStore } from './auth-store';

/** Auth endpoints that must not trigger a refresh-and-retry on 401. */
const CREDENTIAL_ENDPOINTS = ['refresh', 'login', 'register', 'logout'];

function isCredentialEndpoint(url: string, apiBase: string): boolean {
  return CREDENTIAL_ENDPOINTS.some((endpoint) => url.startsWith(`${apiBase}/auth/${endpoint}`));
}

function withAuth(req: HttpRequest<unknown>, token: string | null, apiBase: string): HttpRequest<unknown> {
  const withCredentials = req.withCredentials || req.url.startsWith(`${apiBase}/auth/`);
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
  const apiBase = inject(API_BASE_URL);
  if (!req.url.startsWith(apiBase)) {
    return next(req);
  }

  const store = inject(AuthStore);
  const authedReq = withAuth(req, store.accessToken(), apiBase);

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!isUnauthorized || isCredentialEndpoint(req.url, apiBase)) {
        return throwError(() => error);
      }

      const refreshed = store.refresh().pipe(catchError(() => of(null)));
      return refreshed.pipe(
        switchMap((session) => (session ? next(withAuth(req, session.accessToken, apiBase)) : throwError(() => error)))
      );
    })
  );
};
