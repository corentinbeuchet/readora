import { Component, DOCUMENT, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { AuthStore } from '@app/core/auth/auth-store';
import { LayoutStore } from '@app/core/layout/layout-store';
import { ThemeStore } from '@app/core/theme/theme-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { Icon } from '@app/shared/ui/icon/icon';
import { Omnisearch } from './omnisearch/omnisearch';
import { NotificationBell } from './notification-bell/notification-bell';
import { PrimaryNav } from './primary-nav/primary-nav';
import { SiteFooter } from './site-footer/site-footer';
import { NgOptimizedImage } from '@angular/common';

/**
 * Application shell: the header (logo, primary navigation, search, theme switch, account `Menu` or Log in / Sign up),
 * the `<main>` landmark and the footer. Below the lg breakpoint the primary navigation is a tab bar at the bottom.
 */
@Component({
  selector: 'app-shell',
  imports: [NgOptimizedImage, RouterOutlet, RouterLink, Menu, MenuItem, MenuTrigger, MenuContent, HasPermissionDirective, Icon, Omnisearch, NotificationBell, PrimaryNav, SiteFooter],
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  protected readonly layout = inject(LayoutStore);
  protected readonly theme = inject(ThemeStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** The page shown (with its query), so the footer can offer the same page in another language. */
  protected readonly url = signal(this.router.url);
  /** Scanlators, uploaders and moderators get a "Team tools" group in the account menu (US-14). */
  /** Any signed-in reader can start or join a team; Moderation is added for moderators. */
  protected readonly hasTeamTools = computed(() => this.auth.isAuthenticated());
  /** Path of the page shown (no query or fragment); `null` before the first navigation. */
  private currentPath: string | null = null;

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        this.url.set(event.urlAfterRedirects);
        const path = event.urlAfterRedirects.split(/[?#]/)[0];
        const previous = this.currentPath;
        this.currentPath = path;
        // A new page (not the first load, not a filter or tab that only changes the query) takes the focus, so
        // keyboard and screen reader users start on it instead of on the link they used (WCAG 2.4.3).
        if (previous !== null && previous !== path) {
          afterNextRender(() => this.focusPage(), { injector: this.injector });
        }
      });
  }

  /** Focuses the page's `h1` (read aloud by screen readers), or `<main>` while the page is still loading. */
  private focusPage(): void {
    // Looked up at focus time: after SSR the client may rebuild <main> (it hosts the router outlet), so a view query
    // could still point at the server-rendered element.
    const main = this.document.getElementById('main-content');
    if (!main) {
      return;
    }
    const heading = main.querySelector<HTMLElement>('h1');
    if (heading && !heading.hasAttribute('tabindex')) {
      heading.setAttribute('tabindex', '-1');
    }
    (heading ?? main).focus({ preventScroll: true });
  }

  protected async onUserMenuSelected(action: unknown): Promise<void> {
    if (action === 'logout') {
      await firstValueFrom(this.auth.logout());
      void this.router.navigateByUrl('/');
      return;
    }
    if (typeof action === 'string') {
      void this.router.navigateByUrl(action);
    }
  }
}
