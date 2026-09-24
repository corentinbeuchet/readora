import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ListsApi } from '@app/core/api/lists-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';

/**
 * "Add to a list" on a series page (US-05): a disclosure that, once opened, loads my lists and lets me pick one and
 * add an optional note. Closed, it asks for nothing (most visits never add to a list).
 */
@Component({
  selector: 'app-add-to-list',
  imports: [RouterLink, LoadError],
  templateUrl: './add-to-list.html',
  styleUrl: './add-to-list.scss'
})
export class AddToList {
  private readonly api = inject(ListsApi);
  private readonly auth = inject(AuthStore);

  readonly workId = input.required<string>();

  protected readonly open = signal(false);
  private readonly enabled = computed(() => this.open() && this.auth.can('LIBRARY_USE'));
  protected readonly mine = this.api.mineResource(this.enabled);
  protected readonly selected = signal('');
  protected readonly note = signal('');
  protected readonly message = signal<string | null>(null);
  protected readonly adding = asyncAction();

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    const listId = this.selected() || (this.mine.hasValue() ? this.mine.value()[0]?.id : undefined);
    if (!listId) return;
    this.message.set(null);
    await this.adding.run(async () => {
      const list = await firstValueFrom(this.api.addItem(listId, this.workId(), this.note().trim() || undefined));
      this.message.set($localize`:@@catalog.addToList.added:Added to “${list.title}:title:”.`);
      this.note.set('');
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
