import { Component, DOCUMENT, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { NotificationStore } from '@app/core/notifications/notification-store';
import { ReaderNotification } from '@app/core/models/readora.models';
import { timeAgo } from '@app/core/utils/time-ago';

/** How often the unread count is refreshed while the app is open. */
export const NOTIFICATION_POLL_MS = 60_000;

/** Header bell (US-10): unread count, recent notifications, "Mark all as read". */
@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  host: { '(document:keydown.escape)': 'close()' }
})
export class NotificationBell {
  protected readonly store = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly timeAgo = timeAgo;

  protected readonly open = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly label = computed(() => {
    const unread = this.store.unread();
    return unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
  });

  constructor() {
    // Browser only: the count follows navigation and a slow poll.
    afterNextRender(() => {
      void this.store.refreshCount();
      const timer = this.document.defaultView?.setInterval(() => void this.store.refreshCount(), NOTIFICATION_POLL_MS);
      this.destroyRef.onDestroy(() => this.document.defaultView?.clearInterval(timer));
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.store.refreshCount());
    });
  }

  protected async toggle(): Promise<void> {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    await this.store.loadRecent();
  }

  protected close(): void {
    this.open.set(false);
  }

  protected async markAllRead(): Promise<void> {
    this.error.set(null);
    try {
      await this.store.markAllRead();
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    }
  }

  /** Links may carry a query string (`?comment=`), so they go through the router as URLs. */
  protected follow(event: Event, notification: ReaderNotification): void {
    event.preventDefault();
    this.close();
    void this.router.navigateByUrl(notification.link);
  }
}
