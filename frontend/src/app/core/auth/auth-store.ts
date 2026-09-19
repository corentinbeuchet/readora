import { Service, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { ApiError } from '../api/api-client';
import { AuthApi } from '../api/auth-api';
import { AuthResponse, LoginRequest, Permission, RegisterRequest, UserProfile } from '../models/readora.models';

/**
 * Session store. The access token lives only in memory (a signal); the refresh token is an
 * HttpOnly cookie managed by the browser, so a page reload restores the session through
 * `restoreSession()` -> `POST /auth/refresh`.
 */
@Service()
export class AuthStore {
  private readonly authApi = inject(AuthApi);

  private readonly _user = signal<UserProfile | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _restoring = signal(false);
  private refreshInFlight: Observable<AuthResponse | null> | null = null;

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly restoring = this._restoring.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null && this._user() !== null);
  readonly permissions = computed<ReadonlySet<Permission>>(() => new Set(this._user()?.permissions ?? []));
  readonly subscription = computed(() => this._user()?.subscription ?? null);
  readonly isPremium = computed(() => this.subscription()?.active === true && this.subscription()?.plan === 'PREMIUM');

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  hasAnyPermission(...permissions: Permission[]): boolean {
    return permissions.some((p) => this.permissions().has(p));
  }

  hasAllPermissions(...permissions: Permission[]): boolean {
    return permissions.every((p) => this.permissions().has(p));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.authApi.login(request).pipe(tap((res) => this.applySession(res)));
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.authApi.register(request).pipe(tap((res) => this.applySession(res)));
  }

  /**
   * Rotates the refresh cookie and replaces the in-memory token. Concurrent callers share the
   * same request. Resolves `null` (and clears the session) when the cookie is missing/expired.
   */
  refresh(): Observable<AuthResponse | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.authApi.refresh().pipe(
        tap((res) => this.applySession(res)),
        catchError((error: unknown) => {
          if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) {
            this.clearSession();
            return of(null);
          }
          throw error;
        }),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay(1)
      );
    }
    return this.refreshInFlight;
  }

  /** Called once at bootstrap: silently tries to restore the session from the refresh cookie. */
  restoreSession(): Observable<AuthResponse | null> {
    this._restoring.set(true);
    return this.refresh().pipe(
      catchError(() => of(null)),
      finalize(() => this._restoring.set(false))
    );
  }

  setUser(user: UserProfile): void {
    this._user.set(user);
  }

  logout(): Observable<void> {
    return this.authApi.logout().pipe(
      catchError(() => of(null)),
      map(() => undefined),
      finalize(() => this.clearSession())
    );
  }

  clearSession(): void {
    this._accessToken.set(null);
    this._user.set(null);
  }

  private applySession(response: AuthResponse): void {
    this._accessToken.set(response.accessToken);
    this._user.set(response.user);
  }
}
