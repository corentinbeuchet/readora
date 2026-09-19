import { Service, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ReaderNotification } from '@app/core/models/notifications';
import { ApiClient } from './api-client';

/** `/api/v1/notifications` (US-10): the signed-in reader's notifications (`LIBRARY_USE`). */
@Service()
export class NotificationsApi {
  private readonly api = inject(ApiClient);

  unreadCount(): Observable<number> {
    return this.api.get<{ count: number }>('/notifications/unread-count').pipe(map((r) => r.count));
  }

  recent(): Observable<ReaderNotification[]> {
    return this.api.get<ReaderNotification[]>('/notifications');
  }

  markAllRead(): Observable<unknown> {
    return this.api.post('/notifications/read-all');
  }
}
