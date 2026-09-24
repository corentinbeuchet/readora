import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { Permission } from '@app/core/models/identity';
import { PermittedPreloading } from '@app/core/routing/permitted-preloading';

describe('PermittedPreloading', () => {
  let granted: Set<Permission>;
  let loaded: string[];

  beforeEach(() => {
    granted = new Set();
    loaded = [];
    TestBed.configureTestingModule({
      providers: [{ provide: AuthStore, useValue: { hasAllPermissions: (...required: Permission[]) => required.every((p) => granted.has(p)) } }]
    });
  });

  afterEach(() => {
    delete (navigator as { connection?: unknown }).connection;
  });

  it('preloads the pages anyone can open', () => {
    whenTheRouterOffers({ path: 'works' });

    thenPreloaded(['works']);
  });

  it('skips a page behind a permission the visitor lacks, and preloads it once they have it', () => {
    whenTheRouterOffers({ path: 'moderation', data: { permission: 'COMMENT_MODERATE' } });

    thenPreloaded([]);

    givenTheVisitorCan('COMMENT_MODERATE');
    whenTheRouterOffers({ path: 'moderation', data: { permission: 'COMMENT_MODERATE' } });

    thenPreloaded(['moderation']);
  });

  it('reads several required permissions like the guard does', () => {
    givenTheVisitorCan('LIBRARY_USE');

    whenTheRouterOffers({ path: 'studio', data: { permissions: ['LIBRARY_USE', 'COMMENT_MODERATE'] } });

    thenPreloaded([]);
  });

  it('preloads nothing when the browser asks to save data', () => {
    givenTheBrowserSavesData();

    whenTheRouterOffers({ path: 'works' });

    thenPreloaded([]);
  });

  function givenTheVisitorCan(permission: Permission): void {
    granted.add(permission);
  }

  function givenTheBrowserSavesData(): void {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
  }

  function whenTheRouterOffers(route: Route): void {
    const load = (): Observable<unknown> => {
      loaded.push(route.path ?? '');
      return of(null);
    };
    TestBed.inject(PermittedPreloading).preload(route, load).subscribe();
  }

  function thenPreloaded(paths: string[]): void {
    expect(loaded).toEqual(paths);
  }
});
