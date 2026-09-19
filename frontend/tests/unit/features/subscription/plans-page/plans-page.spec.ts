import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { PlansPage } from '@app/features/subscription/plans-page/plans-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { Subscription } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting } from '../../../test-utils';

const CHECKOUT_URL = `${API}/subscriptions/checkout`;

describe('PlansPage', () => {
  let fixture: ComponentFixture<PlansPage>;
  let http: HttpTestingController;
  let store: AuthStore;
  let redirectSpy: ReturnType<typeof vi.fn<(url: string) => void>>;
  let checkoutRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlansPage],
      providers: [provideRouter([{ path: 'login', component: PlansPage }]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(PlansPage);
    redirectSpy = vi.fn<(url: string) => void>();
    // Avoid a real full-page navigation in tests.
    (fixture.componentInstance as unknown as { redirectTo: (url: string) => void }).redirectTo = redirectSpy;
  });

  afterEach(() => http.verify());

  it('sends anonymous visitors to login with a returnUrl', async () => {
    givenIAmOnThePlansPage();

    await whenIClickSubscribe();

    thenIAmOn('/login?returnUrl=%2Fsubscription');
    thenNoCheckoutWasStarted();
  });

  it('starts a PREMIUM checkout and redirects to the Stripe URL for a free reader', async () => {
    await givenIAmSignedIn();
    givenIAmOnThePlansPage();

    thenICanSee('Current plan');

    whenIStartTheCheckout();

    thenTheSubscribeButtonIsDisabled();
    thenACheckoutWasRequestedFor('PREMIUM');

    await whenTheCheckoutAnswers('https://checkout.stripe.com/c/pay/cs_1');

    thenIWasRedirectedTo('https://checkout.stripe.com/c/pay/cs_1');
  });

  it.each(['https://evil.example/pay', 'http://checkout.stripe.com/c/pay/cs_1', 'https://checkout.stripe.com.evil.example/x', 'javascript:alert(1)'])(
    'refuses to redirect to an untrusted checkout URL (%s)',
    async (url) => {
      await givenIAmSignedIn();
      givenIAmOnThePlansPage();

      whenIStartTheCheckout();
      await whenTheCheckoutAnswers(url);

      thenIWasNotRedirected();
      thenISeeTheError('unexpected payment page');
      thenTheSubscribeButtonIsEnabled();
    }
  );

  it('shows the error returned by the API when checkout cannot be created', async () => {
    await givenIAmSignedIn();
    givenIAmOnThePlansPage();

    whenIStartTheCheckout();
    await whenTheCheckoutFails('Stripe is not configured on this server');

    thenISeeTheError('Stripe is not configured');
    thenTheSubscribeButtonIsEnabled();
    thenIWasNotRedirected();
  });

  it('shows Cancel instead of Subscribe for an active PREMIUM subscriber', async () => {
    await givenIAmAPremiumSubscriber({ cancelAtPeriodEnd: false });
    givenIAmOnThePlansPage();

    thenThereIsNoSubscribeButton();
    thenTheCancelButtonReads('Cancel subscription');
  });

  it('after cancelling, shows when Premium ends and no second Cancel button', async () => {
    await givenIAmAPremiumSubscriber({ cancelAtPeriodEnd: true });
    givenIAmOnThePlansPage();

    thenThereIsNoCancelButton();
    thenICanSee('Premium ends');
    thenICannotSee('Renews');
  });

  async function givenIAmSignedIn(): Promise<void> {
    await signIn(store, http);
  }

  async function givenIAmAPremiumSubscriber(renewal: { cancelAtPeriodEnd: boolean }): Promise<void> {
    const subscription: Subscription = {
      plan: 'PREMIUM',
      status: 'ACTIVE',
      active: true,
      currentPeriodEnd: '2027-01-01T00:00:00Z',
      cancelAtPeriodEnd: renewal.cancelAtPeriodEnd,
      planPermissions: ['BOOKMARK_READ', 'BOOKMARK_WRITE']
    };
    await signIn(store, http, mockUser({ permissions: ['COMMENT_WRITE', 'BOOKMARK_READ', 'BOOKMARK_WRITE'], subscription }));
  }

  function givenIAmOnThePlansPage(): void {
    fixture.detectChanges();
  }

  async function whenIClickSubscribe(): Promise<void> {
    subscribeButton().click();
    await fixture.whenStable();
  }

  function whenIStartTheCheckout(): void {
    subscribeButton().click();
    fixture.detectChanges();
    checkoutRequest = http.expectOne(CHECKOUT_URL);
  }

  async function whenTheCheckoutAnswers(url: string): Promise<void> {
    checkoutRequest.flush(ok({ sessionId: 'cs_1', url }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function whenTheCheckoutFails(error: string): Promise<void> {
    checkoutRequest.flush(fail(error), { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function thenIAmOn(url: string): void {
    expect(TestBed.inject(Router).url).toBe(url);
  }

  function thenNoCheckoutWasStarted(): void {
    http.expectNone(CHECKOUT_URL);
  }

  function thenACheckoutWasRequestedFor(plan: string): void {
    expect(checkoutRequest.request.method).toBe('POST');
    expect(checkoutRequest.request.body).toEqual({ plan });
  }

  function thenIWasRedirectedTo(url: string): void {
    expect(redirectSpy).toHaveBeenCalledWith(url);
  }

  function thenIWasNotRedirected(): void {
    expect(redirectSpy).not.toHaveBeenCalled();
  }

  function thenTheSubscribeButtonIsDisabled(): void {
    expect(subscribeButton().disabled).toBe(true);
  }

  function thenTheSubscribeButtonIsEnabled(): void {
    expect(subscribeButton().disabled).toBe(false);
  }

  function thenThereIsNoSubscribeButton(): void {
    expect(subscribeButton()).toBeNull();
  }

  function thenTheCancelButtonReads(label: string): void {
    expect(page().querySelector('.btn-danger')!.textContent).toContain(label);
  }

  function thenThereIsNoCancelButton(): void {
    expect(page().querySelector('.btn-danger')).toBeNull();
  }

  function thenISeeTheError(text: string): void {
    expect(page().querySelector('[role="alert"]')!.textContent).toContain(text);
  }

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function thenICannotSee(text: string): void {
    expect(page().textContent).not.toContain(text);
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function subscribeButton(): HTMLButtonElement {
    return page().querySelector<HTMLButtonElement>('.btn-subscribe')!;
  }
});
