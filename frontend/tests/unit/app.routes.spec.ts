import { routes } from '@app/app.routes';
import { serverRoutes } from '@app/app.routes.server';
import { PrerenderFallback, RenderMode } from '@angular/ssr';
import { ChapterViewer } from '@app/features/reader/components/chapter-viewer';
import { KanbanBoard } from '@app/features/scanlation/components/kanban-board';

describe('app routes', () => {
  it('lazy-load every page (loadComponent, never an eager component)', () => {
    const pages = routes.filter((r) => !r.redirectTo);
    expect(pages.length).toBeGreaterThan(0);
    for (const route of pages) {
      expect(route.component, `route "${route.path}"`).toBeUndefined();
      expect(typeof route.loadComponent, `route "${route.path}"`).toBe('function');
    }
  });

  it('resolve the reader and the scanlation board lazily', async () => {
    const load = (path: string) => (routes.find((r) => r.path === path)!.loadComponent as () => Promise<unknown>)();
    expect(await load('read/:chapterId')).toBe(ChapterViewer);
    expect(await load('scanlation')).toBe(KanbanBoard);
    expect(await load('scanlation/:projectId')).toBe(KanbanBoard);
  });

  it('give every page an explicit server render mode, with a browser fallback for prerendered params', () => {
    const serverPaths = new Set(serverRoutes.map((r) => r.path));
    const missing = routes.filter((r) => !r.redirectTo && !serverPaths.has(r.path ?? '')).map((r) => r.path);
    expect(missing).toEqual([]);
    for (const route of serverRoutes.filter((r) => r.renderMode === RenderMode.Prerender && r.path.includes(':'))) {
      expect((route as { fallback?: PrerenderFallback }).fallback, route.path).toBe(PrerenderFallback.Client);
    }
  });
});
