import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { PlansPage } from '@app/features/subscription/plans-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting } from '../../test-utils';

describe('PlansPage', () => {
  let fixture: ComponentFixture<PlansPage>;
  let http: HttpTestingController;
  let store: AuthStore;
  let redirectSpy: ReturnType<typeof vi.fn<(url: string) => void>>;

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

  const subscribeBtn = (): HTMLButtonElement => fixture.nativeElement.querySelector('.btn-subscribe');

  it('sends anonymous visitors to login with a returnUrl', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    subscribeBtn().click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/subscription' } });
    http.expectNone(`${API}/subscriptions/checkout`);
  });

  it('starts a PREMIUM checkout and redirects to the Stripe URL for a free reader', async () => {
    await signIn(store, http);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Current plan');

    subscribeBtn().click();
    fixture.detectChanges();
    expect(subscribeBtn().disabled).toBe(true);

    const req = http.expectOne(`${API}/subscriptions/checkout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ plan: 'PREMIUM' });
    req.flush(ok({ sessionId: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' }));
    await fixture.whenStable();

    expect(redirectSpy).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_1');
  });

  it.each(['https://evil.example/pay', 'http://checkout.stripe.com/c/pay/cs_1', 'https://checkout.stripe.com.evil.example/x', 'javascript:alert(1)'])(
    'refuses to redirect to an untrusted checkout URL (%s)',
    async (url) => {
      await signIn(store, http);
      fixture.detectChanges();
      subscribeBtn().click();
      http.expectOne(`${API}/subscriptions/checkout`).flush(ok({ sessionId: 'cs_1', url }));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(redirectSpy).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('unexpected payment page');
      expect(subscribeBtn().disabled).toBe(false);
    }
  );

  it('shows the error returned by the API when checkout cannot be created', async () => {
    await signIn(store, http);
    fixture.detectChanges();
    subscribeBtn().click();
    http.expectOne(`${API}/subscriptions/checkout`).flush(
      fail('Stripe is not configured on this server'),
      { status: 502, statusText: 'Bad Gateway' }
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Stripe is not configured');
    expect(subscribeBtn().disabled).toBe(false);
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it('shows Cancel instead of Subscribe for an active PREMIUM subscriber', async () => {
    await signIn(
      store,
      http,
      mockUser({
        permissions: ['COMMENT_WRITE', 'BOOKMARK_READ', 'BOOKMARK_WRITE'],
        subscription: { plan: 'PREMIUM', status: 'ACTIVE', active: true, currentPeriodEnd: '2027-01-01T00:00:00Z', planPermissions: ['BOOKMARK_READ', 'BOOKMARK_WRITE'] }
      })
    );
    fixture.detectChanges();
    expect(subscribeBtn()).toBeNull();
    expect(fixture.nativeElement.querySelector('.btn-danger').textContent).toContain('Cancel subscription');
  });

  it('after cancelling, shows when Premium ends and no second Cancel button', async () => {
    await signIn(
      store,
      http,
      mockUser({
        permissions: ['COMMENT_WRITE', 'BOOKMARK_READ', 'BOOKMARK_WRITE'],
        subscription: {
          plan: 'PREMIUM', status: 'ACTIVE', active: true, currentPeriodEnd: '2027-01-01T00:00:00Z', cancelAtPeriodEnd: true,
          planPermissions: ['BOOKMARK_READ', 'BOOKMARK_WRITE']
        }
      })
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.btn-danger')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Premium ends');
    expect(fixture.nativeElement.textContent).not.toContain('Renews');
  });
});
