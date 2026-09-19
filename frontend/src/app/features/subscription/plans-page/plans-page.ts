import { Component, DOCUMENT, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SubscriptionsApi } from '@app/core/api/subscriptions-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { apiErrorMessage } from '@app/core/api/api-client';

export const PREMIUM_FEATURES = [
  'Bookmarks & reading progress synced across devices',
  'Continue reading from your profile',
  'Support the scanlation teams you love'
] as const;

export const FREE_FEATURES = ['Read every published chapter', 'Comment and reply', 'Upvote the best comments'] as const;

/** Hosts the checkout redirect may point to (Stripe Checkout). Anything else is refused. */
export const TRUSTED_CHECKOUT_HOSTS: readonly string[] = ['checkout.stripe.com'];

/** True for an `https:` URL on a trusted checkout host (no credentials, no other scheme). */
export function isTrustedCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && TRUSTED_CHECKOUT_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-plans-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './plans-page.html',
  styleUrl: './plans-page.scss'
})
export class PlansPage {
  private readonly subscriptionsApi = inject(SubscriptionsApi);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly seo = inject(SeoService);
  protected readonly auth = inject(AuthStore);

  protected readonly freeFeatures = FREE_FEATURES;
  protected readonly premiumFeatures = PREMIUM_FEATURES;
  protected readonly busy = signal<'checkout' | 'cancel' | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly subscription = this.auth.subscription;
  protected readonly isPremium = this.auth.isPremium;
  protected readonly canCancel = computed(() => {
    const sub = this.subscription();
    return !!sub && sub.plan !== 'FREE' && sub.status !== 'CANCELED' && !sub.cancelAtPeriodEnd;
  });

  constructor() {
    this.seo.update({
      title: 'Plans — Free & Premium',
      description: 'Reading is always free on Readora. Go Premium for bookmarks and synced reading progress.',
      path: '/subscription',
      noindex: true
    });
  }

  protected async subscribe(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: '/subscription' } });
      return;
    }
    this.error.set(null);
    this.busy.set('checkout');
    try {
      const session = await firstValueFrom(this.subscriptionsApi.checkout('PREMIUM'));
      if (!isTrustedCheckoutUrl(session.url)) {
        // Never follow an unexpected external redirect (compromised/misconfigured API, open redirect).
        this.error.set('Could not start the checkout: unexpected payment page. Please contact support.');
        this.busy.set(null);
        return;
      }
      this.redirectTo(session.url);
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Could not start the checkout'));
      this.busy.set(null);
    }
  }

  protected async cancel(): Promise<void> {
    if (!this.document.defaultView?.confirm('Cancel your Premium subscription? You keep Premium until the end of the current period.')) {
      return;
    }
    this.error.set(null);
    this.busy.set('cancel');
    try {
      await firstValueFrom(this.subscriptionsApi.cancel());
      await firstValueFrom(this.auth.refresh());
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Could not cancel the subscription'));
    } finally {
      this.busy.set(null);
    }
  }

  /** Overridable for tests: full-page redirect to Stripe Checkout. */
  protected redirectTo(url: string): void {
    this.document.defaultView?.location.assign(url);
  }
}
