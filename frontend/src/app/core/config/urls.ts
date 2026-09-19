import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

const withoutTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

/** Backend API root (e.g. `https://api.readora.com/api/v1`), without a trailing slash. Override it in tests. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', { factory: () => withoutTrailingSlash(environment.apiUrl) });

/** Public origin of the frontend, for canonical URLs and Open Graph tags, without a trailing slash. */
export const SITE_URL = new InjectionToken<string>('SITE_URL', { factory: () => withoutTrailingSlash(environment.siteUrl) });
