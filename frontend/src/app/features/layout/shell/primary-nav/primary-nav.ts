import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { Icon } from '@app/shared/ui/icon/icon';

/**
 * The site's primary navigation (US-14): one list of links, never an ARIA menubar. CSS alone decides its shape, so the
 * prerendered HTML is right on every screen: a tab bar fixed to the bottom below the lg breakpoint, links inside the
 * header from lg. At most five entries show at once:
 * - Home only in the tab bar (on a computer the logo is the way home);
 * - Library for signed-in readers; it takes the place of Lists in the tab bar.
 */
@Component({
  selector: 'app-primary-nav',
  imports: [RouterLink, RouterLinkActive, HasPermissionDirective, Icon],
  templateUrl: './primary-nav.html',
  styleUrl: './primary-nav.scss'
})
export class PrimaryNav {}
