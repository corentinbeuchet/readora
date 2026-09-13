import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CheckoutSession, Subscription, SubscriptionPlan } from '../models/readora.models';
import { ApiClient } from './api-client';

/** `/api/v1/subscriptions` */
@Injectable({ providedIn: 'root' })
export class SubscriptionsApi {
  private readonly api = inject(ApiClient);

  current(): Observable<Subscription> {
    return this.api.get<Subscription>('/subscriptions/me');
  }

  checkout(plan: Exclude<SubscriptionPlan, 'FREE'> = 'PREMIUM'): Observable<CheckoutSession> {
    return this.api.post<CheckoutSession>('/subscriptions/checkout', { plan });
  }

  cancel(): Observable<Subscription> {
    return this.api.post<Subscription>('/subscriptions/cancel');
  }
}
