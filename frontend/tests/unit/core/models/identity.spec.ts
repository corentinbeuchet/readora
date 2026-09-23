import { Subscription, SubscriptionPlan, hasActivePremium } from '@app/core/models/identity';

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

  it('a signed-out reader has no premium', () => {
    givenIHaveNoSubscription();

    thenIHavePremium(false);
  });

  function givenMySubscription(overrides: Partial<Subscription>): void {
    subscription = { plan: 'PREMIUM', status: 'ACTIVE', active: true, currentPeriodEnd: null, planPermissions: [], ...overrides };
  }

  function givenIHaveNoSubscription(): void {
    subscription = null;
  }

  function thenIHavePremium(expected: boolean): void {
    expect(hasActivePremium(subscription)).toBe(expected);
  }
});
