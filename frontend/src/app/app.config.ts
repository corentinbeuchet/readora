import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withNavigationErrorHandler } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { recoverFromChunkLoadFailure } from './core/routing/chunk-load-recovery';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // After a deploy, old tabs can't load the removed lazy chunks: reload the page once to get the new build.
      withNavigationErrorHandler((error) => recoverFromChunkLoadFailure(error))
    ),
    // FetchBackend is the default HttpBackend in Angular 22 (withFetch() is deprecated).
    provideHttpClient(withInterceptors([authInterceptor])),
    provideClientHydration(withEventReplay())
    // Session restore is browser-only: see app.config.browser.ts.
  ]
};
