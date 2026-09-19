import { Subscription, SubscriptionPlan, SubscriptionStatus, canCancelSubscription, hasActivePremium } from '@app/core/models/identity';

describe('subscription rules', () => {
  let subscription: Subscription | null;

  it.each<[SubscriptionPlan, boolean, boolean]>([
    ['PREMIUM', true, true],
    ['PREMIUM', false, false],
    ['FREE', true, false]
  ])('a %s plan with active=%s gives premium: %s', (plan, active, premium) => {
    givenMySubscription({ plan, active });

    thenIHavePremium(premium);
  });

  it('a signed-out reader has no premium and nothing to cancel', () => {
    givenIHaveNoSubscription();

    thenIHavePremium(false);
    thenICanCancel(false);
  });

  it.each<[SubscriptionPlan, SubscriptionStatus, boolean, boolean]>([
    ['PREMIUM', 'ACTIVE', false, true],
    ['PREMIUM', 'PAST_DUE', false, true],
    ['PREMIUM', 'ACTIVE', true, false],
    ['PREMIUM', 'CANCELED', false, false],
    ['FREE', 'ACTIVE', false, false]
  ])('a %s plan that is %s, cancel at period end %s, can be cancelled: %s', (plan, status, cancelAtPeriodEnd, cancellable) => {
    givenMySubscription({ plan, status, cancelAtPeriodEnd });

    thenICanCancel(cancellable);
  });

  function givenMySubscription(overrides: Partial<Subscription>): void {
    subscription = { plan: 'PREMIUM', status: 'ACTIVE', active: true, currentPeriodEnd: null, cancelAtPeriodEnd: false, planPermissions: [], ...overrides };
  }

  function givenIHaveNoSubscription(): void {
    subscription = null;
  }

  function thenIHavePremium(expected: boolean): void {
    expect(hasActivePremium(subscription)).toBe(expected);
  }

  function thenICanCancel(expected: boolean): void {
    expect(canCancelSubscription(subscription)).toBe(expected);
  }
});
