import { Component, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';

export const PREMIUM_FEATURES: readonly string[] = [
  $localize`:@@subscription.plans.premiumBookmarks:Bookmarks & reading progress synced across devices`,
  $localize`:@@subscription.plans.premiumContinue:Continue reading from your profile`,
  $localize`:@@subscription.plans.premiumSupport:Support the scanlation teams you love`
];

export const FREE_FEATURES: readonly string[] = [
  $localize`:@@subscription.plans.freeRead:Read every published chapter`,
  $localize`:@@subscription.plans.freeComment:Comment and reply`,
  $localize`:@@subscription.plans.freeUpvote:Upvote the best comments`
];

/**
 * The Free and Premium plans (`/subscription`). Payments were removed until a payments feature comes back: Premium
 * cannot be bought here, and a reader who has it sees until when.
 */
@Component({
  selector: 'app-plans-page',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './plans-page.html',
  styleUrl: './plans-page.scss'
})
export class PlansPage {
  protected readonly auth = inject(AuthStore);

  protected readonly freeFeatures = FREE_FEATURES;
  protected readonly premiumFeatures = PREMIUM_FEATURES;
  protected readonly subscription = this.auth.subscription;
  protected readonly isPremium = this.auth.isPremium;

  constructor() {
    inject(SeoService).update({
      title: $localize`:@@subscription.plans.seoTitle:Plans — Free & Premium`,
      description: $localize`:@@subscription.plans.seoDescription:Reading is always free on Readora. Go Premium for bookmarks and synced reading progress.`,
      path: '/subscription',
      noindex: true
    });
  }
}
