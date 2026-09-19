import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '@app/core/api/api-client';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReaderNotification } from '@app/core/models/readora.models';

/** The signed-in reader's notifications (US-10): unread count for the bell, and the recent list. */
@Service()
export class NotificationStore {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthStore);

  private readonly _unread = signal(0);
  private readonly _items = signal<ReaderNotification[]>([]);
  private readonly _loadError = signal(false);
  readonly unread = this._unread.asReadonly();
  readonly items = this._items.asReadonly();
  readonly loadError = this._loadError.asReadonly();

  /** Best effort: a failed refresh keeps the last known count. */
  async refreshCount(): Promise<void> {
    if (!this.auth.can('LIBRARY_USE')) {
      this._unread.set(0);
      return;
    }
    try {
      const { count } = await firstValueFrom(this.api.get<{ count: number }>('/notifications/unread-count'));
      this._unread.set(count);
    } catch {
      // Keep the previous count; the next refresh tries again.
    }
  }

  async loadRecent(): Promise<void> {
    try {
      this._items.set(await firstValueFrom(this.api.get<ReaderNotification[]>('/notifications')));
      this._loadError.set(false);
    } catch {
      this._loadError.set(true);
    }
  }

  async markAllRead(): Promise<void> {
    await firstValueFrom(this.api.post('/notifications/read-all'));
    this._unread.set(0);
    this._items.update((items) => items.map((item) => ({ ...item, read: true })));
  }
}
