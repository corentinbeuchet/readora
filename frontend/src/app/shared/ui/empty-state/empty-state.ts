import { Component } from '@angular/core';

/**
 * An empty list or page: a short message saying what goes here (projected), and one action that fills it, in an
 * element marked `emptyAction`. An empty screen is an invitation to act, never a dead end.
 *
 * ```html
 * <app-empty-state>
 *   <ng-container i18n="@@library.page.empty">Your library is empty.</ng-container>
 *   <a emptyAction routerLink="/works" class="btn btn-primary" i18n="@@library.page.browse">Browse the catalog</a>
 * </app-empty-state>
 * ```
 */
@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss'
})
export class EmptyState {}
