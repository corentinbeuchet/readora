import { Service, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationsApi } from '@app/core/api/notifications-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReaderNotification } from '@app/core/models/notifications';

interface NotificationsState {
  /** The user the data was loaded for: after a logout or a switch of account it's never shown to someone else. */
  owner: string;
  unread: number;
  items: ReaderNotification[];
  loadError: boolean;
}

/** The signed-in reader's notifications (US-10): unread count for the bell, and the recent list. */
@Service()
export class NotificationStore {
  private readonly api = inject(NotificationsApi);
  private readonly auth = inject(AuthStore);

  private readonly _state = signal<NotificationsState | null>(null);
  /** Only the latest count request may update the count (navigation and the poll can overlap). */
  private countRequest = 0;

  private readonly current = computed(() => {
    const state = this._state();
    return state && state.owner === this.auth.user()?.id ? state : null;
  });
  readonly unread = computed(() => this.current()?.unread ?? 0);
  readonly items = computed(() => this.current()?.items ?? []);
  readonly loadError = computed(() => this.current()?.loadError ?? false);

  /** Best effort: a failed refresh keeps the last known count. */
  async refreshCount(): Promise<void> {
    const owner = this.auth.user()?.id;
    if (!owner || !this.auth.can('LIBRARY_USE')) {
      return;
    }
    const request = ++this.countRequest;
    try {
      const unread = await firstValueFrom(this.api.unreadCount());
      if (request === this.countRequest) {
        this.patch(owner, { unread });
      }
    } catch {
      // Keep the previous count; the next refresh tries again.
    }
  }

  async loadRecent(): Promise<void> {
    const owner = this.auth.user()?.id;
    if (!owner) {
      return;
    }
    try {
      this.patch(owner, { items: await firstValueFrom(this.api.recent()), loadError: false });
    } catch {
      this.patch(owner, { loadError: true });
    }
  }

  async markAllRead(): Promise<void> {
    const owner = this.auth.user()?.id;
    await firstValueFrom(this.api.markAllRead());
    if (owner) {
      this.countRequest++;
      this.patch(owner, { unread: 0, items: this.items().map((item) => ({ ...item, read: true })) });
    }
  }

  /** Updates the data of `owner`, starting from empty when it belonged to someone else. */
  private patch(owner: string, change: Partial<NotificationsState>): void {
    this._state.update((state) => ({
      ...(state?.owner === owner ? state : { owner, unread: 0, items: [], loadError: false }),
      ...change,
      owner
    }));
  }
}
