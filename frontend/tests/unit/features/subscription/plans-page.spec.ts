import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { PlansPage } from '@app/features/subscription/plans-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { environment } from '../../../../src/environments/environment';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';

describe('PlansPage', () => {
  let fixture: ComponentFixture<PlansPage>;
  let http: HttpTestingController;
  let store: AuthStore;
  let redirectSpy: ReturnType<typeof vi.fn<(url: string) => void>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlansPage],
      providers: [provideRouter([{ path: 'login', component: PlansPage }]), provideHttpClient(), provideHttpClientTesting()]
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
    http.expectNone(`${environment.apiUrl}/subscriptions/checkout`);
  });

  it('starts a PREMIUM checkout and redirects to the Stripe URL for a free reader', async () => {
    await signIn(store, http);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Current plan');

    subscribeBtn().click();
    fixture.detectChanges();
    expect(subscribeBtn().disabled).toBe(true);

    const req = http.expectOne(`${environment.apiUrl}/subscriptions/checkout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ plan: 'PREMIUM' });
    req.flush({ success: true, data: { sessionId: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' }, error: null });
    await fixture.whenStable();

    expect(redirectSpy).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_1');
  });

  it('shows the error returned by the API when checkout cannot be created', async () => {
    await signIn(store, http);
    fixture.detectChanges();
    subscribeBtn().click();
    http.expectOne(`${environment.apiUrl}/subscriptions/checkout`).flush(
      { success: false, data: null, error: 'Stripe is not configured on this server' },
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
