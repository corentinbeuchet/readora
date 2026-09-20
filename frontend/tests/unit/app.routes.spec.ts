import { Route } from '@angular/router';
import { routes } from '@app/app.routes';
import { serverRoutes } from '@app/app.routes.server';
import { PrerenderFallback, RenderMode } from '@angular/ssr';
import { ReaderPage } from '@app/features/reader/reader-page/reader-page';
import { MyTeamsPage } from '@app/features/scanlation/my-teams-page/my-teams-page';
import { ScanlationBoardPage } from '@app/features/scanlation/scanlation-board-page/scanlation-board-page';

describe('app routes', () => {
  it('lazy-load every page (loadComponent, never an eager component)', () => {
    thenThereArePages();
    thenNoPageIsAnEagerComponent();
    thenEveryPageHasALoadComponent();
  });

  it('resolve the reader and the scanlation board lazily', async () => {
    await thenThePathLoads('read/:chapterId', ReaderPage);
    await thenThePathLoads('scanlation', MyTeamsPage);
    await thenThePathLoads('scanlation/:projectId', ScanlationBoardPage);
  });

  it('give every page an explicit server render mode, with a browser fallback for prerendered params', () => {
    thenEveryPageHasAServerRoute();
    thenEveryPrerenderedRouteWithParamsFallsBackToTheClient();
  });

  function thenThereArePages(): void {
    expect(pages().length).toBeGreaterThan(0);
  }

  function thenNoPageIsAnEagerComponent(): void {
    for (const route of pages()) {
      expect(route.component, `route "${route.path}"`).toBeUndefined();
    }
  }

  function thenEveryPageHasALoadComponent(): void {
    for (const route of pages()) {
      expect(typeof route.loadComponent, `route "${route.path}"`).toBe('function');
    }
  }

  async function thenThePathLoads(path: string, component: unknown): Promise<void> {
    const load = routes.find((r) => r.path === path)!.loadComponent as () => Promise<unknown>;
    expect(await load()).toBe(component);
  }

  function thenEveryPageHasAServerRoute(): void {
    const serverPaths = new Set(serverRoutes.map((r) => r.path));
    const missing = pages()
      .filter((r) => !serverPaths.has(r.path ?? ''))
      .map((r) => r.path);
    expect(missing).toEqual([]);
  }

  function thenEveryPrerenderedRouteWithParamsFallsBackToTheClient(): void {
    for (const route of serverRoutes.filter((r) => r.renderMode === RenderMode.Prerender && r.path.includes(':'))) {
      expect((route as { fallback?: PrerenderFallback }).fallback, route.path).toBe(PrerenderFallback.Client);
    }
  }

  function pages(): Route[] {
    return routes.filter((r) => !r.redirectTo);
  }
});
