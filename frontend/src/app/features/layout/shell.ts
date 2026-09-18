import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { Omnisearch } from '@app/features/catalog/components/omnisearch';

/**
 * Application shell: primary navigation (a list of router links), the header search box, user `Menu`
 * (Profile / Subscription / Logout) or Login button, `<main>` landmark and footer.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Menu, MenuItem, MenuTrigger, MenuContent, HasPermissionDirective, Omnisearch],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Shell {
  protected readonly auth = inject(AuthStore);
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
