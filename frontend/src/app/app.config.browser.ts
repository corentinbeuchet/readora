import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { appConfig } from './app.config';
import { provideSessionRestore } from './core/auth/session-restore';

/** Browser-only providers, the counterpart of `app.config.server.ts`. */
const browserConfig: ApplicationConfig = {
  providers: [
    // Restore the session from the HttpOnly refresh cookie before the first route resolves (with a timeout).
    provideSessionRestore()
  ]
};

export const config = mergeApplicationConfig(appConfig, browserConfig);
