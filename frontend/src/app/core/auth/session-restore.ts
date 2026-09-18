import { EnvironmentProviders, PLATFORM_ID, inject, provideAppInitializer } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { firstValueFrom, of, timeout } from 'rxjs';
import { AuthStore } from './auth-store';

/** Bootstrap never waits longer than this for `POST /auth/refresh`; the app then starts anonymous. */
export const SESSION_RESTORE_TIMEOUT_MS = 4000;

/**
 * Restores the session from the HttpOnly refresh cookie before the first navigation.
 *
 * Browser only: on the server / during prerender there is no user cookie and the page must not
 * depend on a session (it would also block rendering on the API). A slow or hanging API cannot
 * block bootstrap: after `SESSION_RESTORE_TIMEOUT_MS` the app continues anonymous (a late refresh
 * response still applies the session).
 */
export function restoreSessionOnBrowser(): Promise<unknown> {
  if (isPlatformServer(inject(PLATFORM_ID))) {
    return Promise.resolve();
  }
  const restore$ = inject(AuthStore)
    .restoreSession()
    .pipe(timeout({ first: SESSION_RESTORE_TIMEOUT_MS, with: () => of(null) }));
  return firstValueFrom(restore$, { defaultValue: null });
}

/** Browser-only app initializer (registered in `app.config.browser.ts`, never in the server config). */
export function provideSessionRestore(): EnvironmentProviders {
  return provideAppInitializer(restoreSessionOnBrowser);
}
