import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { environment } from '../environments/environment';
import { ApiResponse, ChapterSummary, PagedResponse, WorkSummary } from '@app/core/models/readora.models';

const API = environment.apiUrl.replace(/\/+$/, '');
/** Upper bound of catalog pages prerendered at build time. */
const MAX_PRERENDERED_WORKS = 200;
const FETCH_TIMEOUT_MS = 10_000;

async function fetchApi<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as ApiResponse<T>;
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}

/**
 * Work ids to prerender. When the API is unreachable at build time we log and fall back to
 * prerendering only static routes; dynamic pages are then served by `index.csr.html`.
 */
let workIds: Promise<string[]> | undefined;

/** Fetched once per build, shared by the work and chapter routes. */
function prerenderedWorkIds(): Promise<string[]> {
  workIds ??= fetchApi<PagedResponse<WorkSummary>>(`/works?page=0&size=${MAX_PRERENDERED_WORKS}`).then((page) => {
    if (!page) {
      console.warn(`[prerender] Catalog API unreachable at ${API}: only static routes will be prerendered.`);
      return [];
    }
    return page.items.map((w) => w.id);
  });
  return workIds;
}

async function prerenderedChapterIds(): Promise<string[]> {
  const workIds = await prerenderedWorkIds();
  const perWork = await Promise.all(workIds.map((id) => fetchApi<ChapterSummary[]>(`/works/${id}/chapters`)));
  return perWork.flatMap((chapters) => (chapters ?? []).map((c) => c.id));
}

export const serverRoutes: ServerRoute[] = [
  // Public, indexable pages: prerendered at build time.
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'works', renderMode: RenderMode.Prerender },
  {
    path: 'works/:workId',
    renderMode: RenderMode.Prerender,
    // Static output has no server: pages not prerendered are rendered in the browser (index.csr.html).
    fallback: PrerenderFallback.Client,
    async getPrerenderParams() {
      return (await prerenderedWorkIds()).map((workId) => ({ workId }));
    }
  },
  {
    path: 'read/:chapterId',
    renderMode: RenderMode.Prerender,
    // Static output has no server: pages not prerendered are rendered in the browser (index.csr.html).
    fallback: PrerenderFallback.Client,
    async getPrerenderParams() {
      return (await prerenderedChapterIds()).map((chapterId) => ({ chapterId }));
    }
  },

  // Live data: prerendering would freeze it (and the transfer cache would serve the stale copy).
  { path: 'updates', renderMode: RenderMode.Client },
  { path: 'rankings', renderMode: RenderMode.Client },
  { path: 'u/:username', renderMode: RenderMode.Client },
  { path: 'lists', renderMode: RenderMode.Client },
  { path: 'lists/:listId', renderMode: RenderMode.Client },
  { path: 'teams/:projectId', renderMode: RenderMode.Client },

  // Private / session-dependent pages: client-rendered and `noindex`.
  { path: 'read', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'register', renderMode: RenderMode.Client },
  { path: 'profile', renderMode: RenderMode.Client },
  { path: 'library', renderMode: RenderMode.Client },
  { path: 'history', renderMode: RenderMode.Client },
  { path: 'moderation', renderMode: RenderMode.Client },
  { path: 'subscription', renderMode: RenderMode.Client },
  { path: 'subscription/success', renderMode: RenderMode.Client },
  { path: 'subscription/cancel', renderMode: RenderMode.Client },
  { path: 'upload', renderMode: RenderMode.Client },
  { path: 'scanlation', renderMode: RenderMode.Client },
  { path: 'scanlation/:projectId', renderMode: RenderMode.Client },
  { path: 'forbidden', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client }
];
