import { HttpRequest } from '@angular/common/http';

/**
 * Public catalog reads that prerendered pages may hand over to the browser (HTTP transfer cache): the catalog, a
 * series with its chapters, rating summary and reviews, a chapter's pages. Everything else — user-specific data
 * (library, bookmarks, `rating/mine`, notifications), random picks and live feeds — is always fetched fresh.
 */
const PUBLIC_CATALOG = /\/api\/v1\/(works(\/genres|\/[^/?]+(\/(chapters|ratings|reviews))?)?|chapters\/[^/?]+)(\?|$)/;
const NEVER = /\/works\/random(\?|$)/;

export function isTransferCacheable(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && PUBLIC_CATALOG.test(req.url) && !NEVER.test(req.url);
}
