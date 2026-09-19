import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink],
  template: `
    <section class="page-narrow">
      <div class="card">
        <h1>Access denied</h1>
        <p class="muted">Your account doesn't have permission to view this page.</p>
        @if (auth.isAuthenticated()) {
          <a routerLink="/" class="btn btn-primary">Back to home</a>
        } @else {
          <a routerLink="/login" class="btn btn-primary">Log in</a>
        }
      </div>
    </section>
  `
})
export class ForbiddenPage {
  protected readonly auth = inject(AuthStore);

  constructor() {
    inject(SeoService).private_('Access denied');
  }
}
