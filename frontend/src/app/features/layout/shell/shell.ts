import { Component, DOCUMENT, ElementRef, Injector, LOCALE_ID, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { AuthStore } from '@app/core/auth/auth-store';
import { LayoutStore } from '@app/core/layout/layout-store';
import { ThemeStore, toThemePreference } from '@app/core/theme/theme-store';
import { SITE_LOCALES, localizedPath, siteLocale } from '@app/core/i18n/site-locales';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { Omnisearch } from './omnisearch/omnisearch';
import { NotificationBell } from './notification-bell/notification-bell';
import { NgOptimizedImage } from '@angular/common';

/**
 * Application shell: primary navigation (a list of router links), the header search box, user `Menu`
 * (Profile / Subscription / Logout) or Login button, `<main>` landmark and footer.
 */
@Component({
  selector: 'app-shell',
  imports: [NgOptimizedImage, RouterOutlet, RouterLink, RouterLinkActive, Menu, MenuItem, MenuTrigger, MenuContent, HasPermissionDirective, Omnisearch, NotificationBell],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  // Escape anywhere closes the small-screen navigation (no-op when it is closed).
  host: { '(keydown.escape)': 'closeNav({ returnFocus: true })' }
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  protected readonly layout = inject(LayoutStore);
  protected readonly theme = inject(ThemeStore);
  private readonly router = inject(Router);
  private readonly locale = siteLocale(inject(LOCALE_ID));
  protected readonly year = new Date().getFullYear();

  /** Small screens: whether the primary navigation disclosure is open (always shown from the lg breakpoint). */
  protected readonly navOpen = signal(false);
  private readonly navToggle = viewChild.required<ElementRef<HTMLButtonElement>>('navToggle');
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  /** The page shown (with its query), to open the same page in another language. */
  private readonly url = signal(this.router.url);
  /** Language switcher: each language is its own build, so the links are full page loads, not router links. */
  protected readonly languages = computed(() =>
    SITE_LOCALES.map((language) => ({ ...language, current: language.code === this.locale.code, href: localizedPath(language, this.url()) }))
  );
  /** Path of the page shown (no query or fragment); `null` before the first navigation. */
  private currentPath: string | null = null;

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        this.navOpen.set(false);
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

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(options: { returnFocus: boolean }): void {
    if (!this.navOpen()) {
      return;
    }
    this.navOpen.set(false);
    if (options.returnFocus) {
      this.navToggle().nativeElement.focus();
    }
  }

  protected chooseTheme(value: string): void {
    this.theme.setPreference(toThemePreference(value));
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
