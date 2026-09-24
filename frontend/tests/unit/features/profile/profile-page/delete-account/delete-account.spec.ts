import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { DeleteAccount } from '@app/features/profile/profile-page/delete-account/delete-account';
import { AuthStore } from '@app/core/auth/auth-store';
import { signIn } from '../../../../core/auth/auth-fixtures';
import { ANY_URL, API, fail, ok, provideHttpTesting, settle } from '../../../../test-utils';

describe('DeleteAccount (US-15)', () => {
  let fixture: ComponentFixture<DeleteAccount>;
  let http: HttpTestingController;
  let request: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteAccount],
      providers: [provideRouter(ANY_URL), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    await signIn(TestBed.inject(AuthStore), http);
    fixture = TestBed.createComponent(DeleteAccount);
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('the form stays folded until I open it', async () => {
    thenTheFormIsShown(false);

    await whenIOpenTheDeletion();

    thenTheFormIsShown(true);
  });

  it('deleting with my password forgets my session and takes me home', async () => {
    await whenIOpenTheDeletion();
    await whenIConfirmWith('first-password');
    await whenTheServerAnswers();

    thenTheRequestWas({ password: 'first-password' });
    thenIAmSignedOut();
    thenIAmOn('/');
  });

  it('a wrong password is explained and I stay signed in', async () => {
    await whenIOpenTheDeletion();
    await whenIConfirmWith('not-the-password');
    await whenTheServerRefuses('WRONG_PASSWORD');

    thenTheAlertSays('Your current password is not right.');
    thenIAmStillSignedIn();
  });

  async function whenIOpenTheDeletion(): Promise<void> {
    page().querySelector<HTMLButtonElement>('button[aria-controls="delete-account-form"]')!.click();
    await settle(fixture);
  }

  async function whenIConfirmWith(password: string): Promise<void> {
    const input = page().querySelector<HTMLInputElement>('#delete-password')!;
    input.value = password;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    page().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  async function whenTheServerAnswers(): Promise<void> {
    request = http.expectOne(`${API}/auth/delete-account`);
    request.flush(ok('Account deleted'));
    await settle(fixture);
  }

  async function whenTheServerRefuses(code: string): Promise<void> {
    request = http.expectOne(`${API}/auth/delete-account`);
    request.flush(fail('The password is wrong', code), { status: 400, statusText: 'Bad Request' });
    await settle(fixture);
  }

  function thenTheFormIsShown(shown: boolean): void {
    expect(page().querySelector<HTMLElement>('#delete-account-form')!.hidden).toBe(!shown);
    expect(page().querySelector('button[aria-controls="delete-account-form"]')!.getAttribute('aria-expanded')).toBe(String(shown));
  }

  function thenTheRequestWas(body: { password: string }): void {
    expect(request.request.body).toEqual(body);
  }

  function thenIAmSignedOut(): void {
    expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(false);
  }

  function thenIAmStillSignedIn(): void {
    expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(true);
  }

  function thenIAmOn(url: string): void {
    expect(TestBed.inject(Router).url).toBe(url);
  }

  function thenTheAlertSays(text: string): void {
    expect(page().querySelector('[role="alert"]')!.textContent).toContain(text);
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }
});
