import { DOCUMENT, Service, inject } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { requiredPermissions } from '@app/core/auth/permission.guard';
import { browserSavesData } from '@app/core/utils/save-data';

/**
 * Preloads the lazy pages the current visitor can open, in the background after navigation, so the next click is
 * instant. A page behind a permission the visitor lacks (route data read as `permissionGuard` reads it: team studio,
 * moderation, admin for a visitor) is not downloaded; the router asks again after every navigation, so signing in preloads those on the next one. Nothing is
 * preloaded when the browser asks to save data (`Save-Data`, `navigator.connection.saveData`).
 */
@Service()
export class PermittedPreloading implements PreloadingStrategy {
  private readonly auth = inject(AuthStore);
  private readonly document = inject(DOCUMENT);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const permitted = this.auth.hasAllPermissions(...requiredPermissions(route));
    return permitted && !browserSavesData(this.document) ? load() : EMPTY;
  }
}
