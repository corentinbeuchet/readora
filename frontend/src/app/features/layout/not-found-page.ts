import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@app/core/seo/seo.service';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <section class="page-narrow">
      <div class="card">
        <h1>Page not found</h1>
        <p class="muted">The page you're looking for doesn't exist or has moved.</p>
        <a routerLink="/" class="btn btn-primary">Back to home</a>
      </div>
    </section>
  `
})
export class NotFoundPage {
  constructor() {
    inject(SeoService).notFound();
  }
}
