import { ApplicationConfig } from '@angular/core';
import {
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
import { skipSameRouteTransitions } from '@app/core/routing/view-transitions';
import { PermittedPreloading } from '@app/core/routing/permitted-preloading';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // After a deploy, old tabs can't load the removed lazy chunks: reload the page once to get the new build.
      withNavigationErrorHandler((error) => recoverFromChunkLoadFailure(error)),
      // Lazy pages the visitor may open download in the background, so later navigations are instant.
      withPreloading(PermittedPreloading),
      // Cross-fade between pages where the browser supports the View Transitions API (no-op elsewhere), not on the first
      // load nor when only the data of the same page changes (filters, paging, next chapter).
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: skipSameRouteTransitions })
    ),
    // FetchBackend is the default HttpBackend in Angular 22 (withFetch() is deprecated).
    provideHttpClient(withInterceptors([authInterceptor])),
    // Only public catalog reads are handed from the prerendered HTML to the browser; user data is always fetched.
    provideClientHydration(withEventReplay(), withHttpTransferCacheOptions({ filter: isTransferCacheable }))
    // Session restore is browser-only: see app.config.browser.ts.
  ]
};
