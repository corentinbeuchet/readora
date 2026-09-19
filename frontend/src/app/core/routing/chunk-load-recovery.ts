import { DOCUMENT, inject } from '@angular/core';
import { NavigationError } from '@angular/router';

/** Messages browsers and bundlers use when a lazy route's JavaScript chunk can't be loaded. */
const CHUNK_LOAD_FAILURE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk .+ failed/i;
const RELOADED_FOR = 'readora.chunk-reload';

export function isChunkLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return CHUNK_LOAD_FAILURE.test(message);
}

/**
 * `withNavigationErrorHandler` handler: after a deploy, a tab still running the previous build asks for chunks that
 * no longer exist, so lazy navigation fails. A full page load of the target URL fetches the new build. Reloads at most
 * once per URL (session storage), so a chunk that is really broken doesn't loop.
 *
 * Runs in the router's injection context.
 */
export function recoverFromChunkLoadFailure(event: NavigationError, reload?: (url: string) => void): void {
  if (!isChunkLoadFailure(event.error)) {
    return;
  }
  const win = inject(DOCUMENT).defaultView;
  if (!win) {
    return;
  }
  try {
    if (win.sessionStorage.getItem(RELOADED_FOR) === event.url) {
      return;
    }
    win.sessionStorage.setItem(RELOADED_FOR, event.url);
  } catch {
    // Storage blocked: reload anyway, a loop is still bounded by the browser's own error page.
  }
  (reload ?? ((url: string) => win.location.assign(url)))(event.url);
}
