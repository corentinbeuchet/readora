import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { ListsApi } from '@app/core/api/lists-api';
import { AuthStore } from '@app/core/auth/auth-store';

/** "Add to a list" on a series page (US-05): pick one of my lists, add an optional note. */
@Component({
  selector: 'app-add-to-list',
  imports: [RouterLink],
  templateUrl: './add-to-list.html'
})
export class AddToList {
  private readonly api = inject(ListsApi);
  private readonly auth = inject(AuthStore);

  readonly workId = input.required<string>();

  private readonly enabled = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly mine = this.api.mineResource(this.enabled);
  protected readonly selected = signal('');
  protected readonly note = signal('');
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    const listId = this.selected() || (this.mine.hasValue() ? this.mine.value()[0]?.id : undefined);
    if (!listId) return;
    this.message.set(null);
    this.error.set(null);
    try {
      const list = await firstValueFrom(this.api.addItem(listId, this.workId(), this.note().trim() || undefined));
      this.message.set(`Added to “${list.title}”.`);
      this.note.set('');
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    }
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
