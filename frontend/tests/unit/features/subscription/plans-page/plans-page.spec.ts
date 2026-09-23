import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PlansPage } from '@app/features/subscription/plans-page/plans-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { Subscription } from '@app/core/models/identity';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { ANY_URL, provideHttpTesting } from '../../../test-utils';

/** Payments were removed: the page describes both plans, and Premium cannot be bought for now. */
describe('PlansPage', () => {
  let fixture: ComponentFixture<PlansPage>;
  let http: HttpTestingController;
  let store: AuthStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlansPage],
      providers: [provideRouter(ANY_URL), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(PlansPage);
  });

  afterEach(() => http.verify());

  it('offers a free account to visitors and says Premium cannot be bought yet', () => {
    givenIAmOnThePlansPage();

    thenICanFollow('Create a free account', '/register');
    thenICanSee("Premium can't be bought yet");
    thenThereIsNoButton();
  });

  it('shows the Free plan as current for a free reader', async () => {
    await givenIAmSignedIn();
    givenIAmOnThePlansPage();

    thenTheCurrentPlanIs('Free');
    thenICanSee("Premium can't be bought yet");
  });

  it('shows Premium as current, with its end date, for a Premium reader', async () => {
    await givenIHavePremiumUntil('2027-01-01T00:00:00Z');
    givenIAmOnThePlansPage();

    thenTheCurrentPlanIs('Premium');
    thenICanSee('Premium until Jan 1, 2027');
    thenICannotSee("can't be bought");
  });

  async function givenIAmSignedIn(): Promise<void> {
    await signIn(store, http);
  }

  async function givenIHavePremiumUntil(periodEnd: string): Promise<void> {
    const subscription: Subscription = {
      plan: 'PREMIUM',
      status: 'ACTIVE',
      active: true,
      currentPeriodEnd: periodEnd,
      planPermissions: ['BOOKMARK_READ', 'BOOKMARK_WRITE']
    };
    await signIn(store, http, mockUser({ permissions: ['COMMENT_WRITE', 'BOOKMARK_READ', 'BOOKMARK_WRITE'], subscription }));
  }

  function givenIAmOnThePlansPage(): void {
    fixture.detectChanges();
  }

  function thenICanFollow(label: string, href: string): void {
    const link = Array.from(page().querySelectorAll('a')).find((a) => a.textContent?.includes(label));
    expect(link?.getAttribute('href')).toBe(href);
  }

  function thenTheCurrentPlanIs(plan: string): void {
    const current = page().querySelector('.plan-current h2')!;
    expect(current.textContent).toContain(plan);
  }

  function thenThereIsNoButton(): void {
    expect(page().querySelector('button')).toBeNull();
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
});
