import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';

export type CheckoutOutcome = 'success' | 'cancel';

/**
 * Landing page after Stripe Checkout. On success it refreshes the session so the new
 * permissions (BOOKMARK_READ / BOOKMARK_WRITE) land in the store; the webhook may lag a
 * few seconds behind the redirect, so the user can retry.
 */
@Component({
  selector: 'app-checkout-result-page',
  imports: [RouterLink],
  templateUrl: './checkout-result-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckoutResultPage {
  private readonly auth = inject(AuthStore);

  /** Bound from route `data` (`success` | `cancel`). Stripe also appends `?session_id=`, which we don't need: the webhook drives activation. */
  readonly outcome = input.required<CheckoutOutcome>();

  protected readonly refreshing = signal(false);
  protected readonly isPremium = this.auth.isPremium;

  constructor() {
    inject(SeoService).private_('Checkout');
    void this.syncSession();
  }

  protected async syncSession(): Promise<void> {
    if (this.refreshing()) {
      return;
    }
    this.refreshing.set(true);
    try {
      await firstValueFrom(this.auth.refresh());
    } catch {
      // Ignore: the user can retry manually.
    } finally {
      this.refreshing.set(false);
    }
  }
}
