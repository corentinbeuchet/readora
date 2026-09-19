import { ApplicationConfig } from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withPreloading,
  withViewTransitions
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { routes } from './app.routes';
import { authInterceptor } from '@app/core/auth/auth.interceptor';
import { isTransferCacheable } from '@app/core/api/transfer-cache';
import { recoverFromChunkLoadFailure } from '@app/core/routing/chunk-load-recovery';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // After a deploy, old tabs can't load the removed lazy chunks: reload the page once to get the new build.
      withNavigationErrorHandler((error) => recoverFromChunkLoadFailure(error)),
      // Lazy pages download in the background after the first render, so later navigations are instant.
      withPreloading(PreloadAllModules),
      // Cross-fade between pages where the browser supports the View Transitions API (no-op elsewhere).
      withViewTransitions()
    ),
    // FetchBackend is the default HttpBackend in Angular 22 (withFetch() is deprecated).
    provideHttpClient(withInterceptors([authInterceptor])),
    // Only public catalog reads are handed from the prerendered HTML to the browser; user data is always fetched.
    provideClientHydration(withEventReplay(), withHttpTransferCacheOptions({ filter: isTransferCacheable }))
    // Session restore is browser-only: see app.config.browser.ts.
  ]
};
