import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ListsApi } from '@app/core/api/lists-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { asyncAction } from '@app/core/utils/async-action';

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
  protected readonly adding = asyncAction();

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    const listId = this.selected() || (this.mine.hasValue() ? this.mine.value()[0]?.id : undefined);
    if (!listId) return;
    this.message.set(null);
    await this.adding.run(async () => {
      const list = await firstValueFrom(this.api.addItem(listId, this.workId(), this.note().trim() || undefined));
      this.message.set(`Added to “${list.title}”.`);
      this.note.set('');
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
