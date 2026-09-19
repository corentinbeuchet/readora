import { Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ListsApi } from '@app/core/api/lists-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReadingList } from '@app/core/models/readora.models';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';

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
  /** The loaded list, `null` while loading or on error. Local changes are written back with `list.set(...)`. */
  protected readonly current = computed<ReadingList | null>(() => (this.list.hasValue() ? (this.list.value() ?? null) : null));
  protected readonly isOwner = computed(() => this.current()?.ownerId === this.auth.user()?.id && !!this.current());
  protected readonly canUpvote = computed(() => this.auth.can('LIBRARY_USE') && !this.isOwner());
  /** The owner's edit in progress; dropped when another list is opened, so it can never be saved to that list. */
  protected readonly draft = linkedSignal<string | undefined, Draft | null>({ source: this.listId, computation: () => null });
  protected readonly message = signal<string | null>(null);
  /** Save and upvote. */
  protected readonly action = asyncAction();

  constructor() {
    effect(() => {
      const loaded = this.current();
      if (loaded) {
        untracked(() =>
          this.seo.update({ title: `${loaded.title} — a list by ${loaded.ownerUsername}`, description: loaded.description || loaded.title, path: `/lists/${loaded.id}` })
        );
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
      this.action.fail('Give your list a title');
      return;
    }
    await this.action.run(async () => {
      const saved = await firstValueFrom(
        this.api.update(id, {
          title: draft.title,
          description: draft.description,
          published: draft.published,
          items: draft.items.map((item) => ({ workId: item.workId, note: item.note || null }))
        })
      );
      this.list.set(saved);
      this.draft.set(null);
      this.message.set(saved.published ? 'Saved. Your list is public.' : 'Saved. Your list is private.');
    });
  }

  protected async upvote(): Promise<void> {
    const list = this.current();
    if (!list) return;
    await this.action.run(async () => {
      const upvotes = await firstValueFrom(this.api.upvote(list.id));
      this.list.update((l) => (l ? { ...l, upvotes } : l));
    });
  }
}
