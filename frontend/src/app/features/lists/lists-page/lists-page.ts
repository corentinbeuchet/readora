import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { ListsApi } from '@app/core/api/lists-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { LoadError } from '@app/shared/ui/load-error';

/** Community lists (US-05): the most upvoted public lists, my lists, and a new-list form. */
@Component({
  selector: 'app-lists-page',
  imports: [LoadError, FieldErrors, AriaInvalidDirective, RouterLink, FormField, HasPermissionDirective],
  templateUrl: './lists-page.html',
  styleUrl: './lists-page.scss'
})
export class ListsPage {
  private readonly api = inject(ListsApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly top = this.api.topResource();
  private readonly canCreate = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly mine = this.api.mineResource(this.canCreate);
  protected readonly creating = asyncAction();
  protected readonly model = signal({ title: '', description: '' });
  protected readonly newListForm = form(this.model, (path) => {
    required(path.title, { message: $localize`:@@lists.page.new.titleRequired:Give your list a title` });
    maxLength(path.title, 100);
    maxLength(path.description, 500);
  });

  constructor() {
    inject(SeoService).update({
      title: $localize`:@@lists.page.seoTitle:Lists — curated by readers`,
      description: $localize`:@@lists.page.seoDescription:Reading lists shared by the Readora community.`,
      path: '/lists'
    });
  }

  /** Creates an empty private list, then opens it for editing. */
  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.creating.clearError();
    await submit(this.newListForm, async (f) => {
      const { title, description } = f().value();
      await this.creating.run(async () => {
        const list = await firstValueFrom(this.api.create({ title, description, published: false, items: [] }));
        void this.router.navigate(['/lists', list.id]);
      });
    });
  }
}
