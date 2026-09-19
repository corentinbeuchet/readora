import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CheckoutSession, Subscription, SubscriptionPlan } from '@app/core/models/identity';
import { ApiClient } from './api-client';

/** `/api/v1/subscriptions` */
@Service()
export class SubscriptionsApi {
  private readonly api = inject(ApiClient);

  checkout(plan: Exclude<SubscriptionPlan, 'FREE'> = 'PREMIUM'): Observable<CheckoutSession> {
    return this.api.post<CheckoutSession>('/subscriptions/checkout', { plan });
  }

  cancel(): Observable<Subscription> {
    return this.api.post<Subscription>('/subscriptions/cancel');
  }
}
