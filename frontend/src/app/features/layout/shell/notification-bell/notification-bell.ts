import { Component, DOCUMENT, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NotificationStore } from '@app/core/notifications/notification-store';
import { ReaderNotification } from '@app/core/models/notifications';
import { asyncAction } from '@app/core/utils/async-action';
import { TimeAgoPipe } from '@app/shared/ui/time-ago.pipe';
import { Icon } from '@app/shared/ui/icon/icon';

/** How often the unread count is refreshed while the app is open. */
export const NOTIFICATION_POLL_MS = 60_000;

/** Header bell (US-10): unread count, recent notifications, "Mark all as read". */
@Component({
  selector: 'app-notification-bell',
  imports: [TimeAgoPipe, Icon],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  host: { '(document:keydown.escape)': 'closeAndFocusTrigger()' }
})
export class NotificationBell {
  protected readonly store = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly open = signal(false);
  protected readonly markingRead = asyncAction();
  protected readonly label = computed(() => {
    const unread = this.store.unread();
    return unread > 0 ? $localize`:@@bell.label.unread:Notifications, ${unread}:count: unread` : $localize`:@@bell.label:Notifications`;
  });

  constructor() {
    // Browser only: the count follows navigation and a slow poll.
    afterNextRender(() => {
      void this.store.refreshCount();
      // No polling while the tab is in the background; navigation and the next tick catch up.
      const timer = this.document.defaultView?.setInterval(() => {
        if (this.document.visibilityState !== 'hidden') {
          void this.store.refreshCount();
        }
      }, NOTIFICATION_POLL_MS);
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

  /** Escape: close the panel and give focus back to the bell, so it isn't lost in the hidden panel. */
  protected closeAndFocusTrigger(): void {
    if (this.open()) {
      this.close();
      this.trigger().nativeElement.focus();
    }
  }

  protected async markAllRead(): Promise<void> {
    await this.markingRead.run(() => this.store.markAllRead());
  }

  /** Links may carry a query string (`?comment=`), so they go through the router as URLs. */
  protected follow(event: Event, notification: ReaderNotification): void {
    event.preventDefault();
    this.close();
    void this.router.navigateByUrl(notification.link);
  }
}
