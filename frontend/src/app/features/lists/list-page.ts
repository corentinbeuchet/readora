import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { ListsApi } from '@app/core/api/lists-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReadingList } from '@app/core/models/readora.models';
import { SeoService } from '@app/core/seo/seo.service';

interface Draft {
  title: string;
  description: string;
  published: boolean;
  items: { workId: string; title: string; note: string }[];
}

/** One list (US-05): readers see and upvote it; the owner edits it and decides when it is public. */
@Component({
  selector: 'app-list-page',
  imports: [RouterLink],
  templateUrl: './list-page.html',
  styleUrl: './lists.scss'
})
export class ListPage {
  private readonly api = inject(ListsApi);
  private readonly auth = inject(AuthStore);
  private readonly seo = inject(SeoService);

  /** Bound from `lists/:listId`. */
  readonly listId = input<string>();

  protected readonly list = this.api.listResource(this.listId);
  protected readonly current = signal<ReadingList | null>(null);
  protected readonly isOwner = computed(() => !!this.current() && this.current()!.ownerId === this.auth.user()?.id);
  protected readonly canUpvote = computed(() => this.auth.can('LIBRARY_USE') && !this.isOwner());
  protected readonly draft = signal<Draft | null>(null);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const loaded = this.list.hasValue() ? this.list.value() : undefined;
      if (loaded) {
        untracked(() => {
          this.current.set(loaded);
          this.seo.update({ title: `${loaded.title} — a list by ${loaded.ownerUsername}`, description: loaded.description || loaded.title, path: `/lists/${loaded.id}` });
        });
      }
    });
  }

  protected startEditing(): void {
    const list = this.current();
    if (!list) return;
    this.message.set(null);
    this.draft.set({
      title: list.title,
      description: list.description,
      published: list.published,
      items: list.items.map((item) => ({ workId: item.work.id, title: item.work.title, note: item.note ?? '' }))
    });
  }

  protected updateDraft(change: Partial<Draft>): void {
    this.draft.update((d) => (d ? { ...d, ...change } : d));
  }

  protected setNote(index: number, note: string): void {
    this.draft.update((d) => (d ? { ...d, items: d.items.map((item, i) => (i === index ? { ...item, note } : item)) } : d));
  }

  protected removeItem(index: number): void {
    this.draft.update((d) => (d ? { ...d, items: d.items.filter((_, i) => i !== index) } : d));
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    const id = this.listId();
    if (!draft || !id) return;
    if (!draft.title.trim()) {
      this.error.set('Give your list a title');
      return;
    }
    await this.run(async () => {
      const saved = await firstValueFrom(
        this.api.update(id, {
          title: draft.title,
          description: draft.description,
          published: draft.published,
          items: draft.items.map((item) => ({ workId: item.workId, note: item.note || null }))
        })
      );
      this.current.set(saved);
      this.draft.set(null);
      this.message.set(saved.published ? 'Saved. Your list is public.' : 'Saved. Your list is private.');
    });
  }

  protected async upvote(): Promise<void> {
    const list = this.current();
    if (!list) return;
    await this.run(async () => {
      const upvotes = await firstValueFrom(this.api.upvote(list.id));
      this.current.set({ ...list, upvotes });
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
