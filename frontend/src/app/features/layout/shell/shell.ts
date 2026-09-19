import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { AuthStore } from '@app/core/auth/auth-store';
import { LayoutStore } from '@app/core/layout/layout-store';
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
  styleUrl: './shell.scss'
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  protected readonly layout = inject(LayoutStore);
  private readonly router = inject(Router);
  protected readonly year = new Date().getFullYear();

  protected onUserMenuSelected(action: unknown): void {
    if (action === 'logout') {
      this.auth.logout().subscribe(() => void this.router.navigateByUrl('/'));
      return;
    }
    if (typeof action === 'string') {
      void this.router.navigateByUrl(action);
    }
  }
}
