import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { ListsApi } from '@app/core/api/lists-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { AnyField, visibleErrors } from '@app/features/auth/auth-form.utils';

/** Community lists (US-05): the most upvoted public lists, my lists, and a new-list form. */
@Component({
  selector: 'app-lists-page',
  imports: [RouterLink, FormField, HasPermissionDirective],
  templateUrl: './lists-page.html',
  styleUrl: './lists.scss'
})
export class ListsPage {
  private readonly api = inject(ListsApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly top = this.api.topResource();
  private readonly canCreate = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly mine = this.api.mineResource(this.canCreate);
  protected readonly createError = signal<string | null>(null);
  protected readonly model = signal({ title: '', description: '' });
  protected readonly newListForm = form(this.model, (path) => {
    required(path.title, { message: 'Give your list a title' });
    maxLength(path.title, 100);
    maxLength(path.description, 500);
  });

  constructor() {
    inject(SeoService).update({ title: 'Lists — curated by readers', description: 'Reading lists shared by the Readora community.', path: '/lists' });
  }

  protected errors(field: AnyField): string[] {
    return visibleErrors(field);
  }

  /** Creates an empty private list, then opens it for editing. */
  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.createError.set(null);
    await submit(this.newListForm, async (f) => {
      const { title, description } = f().value();
      try {
        const list = await firstValueFrom(this.api.create({ title, description, published: false, items: [] }));
        void this.router.navigate(['/lists', list.id]);
      } catch (error) {
        this.createError.set(apiErrorMessage(error));
      }
    });
  }
}
