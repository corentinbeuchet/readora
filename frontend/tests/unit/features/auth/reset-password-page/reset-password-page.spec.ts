import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ResetPasswordPage } from '@app/features/auth/reset-password-page/reset-password-page';
import { API, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

describe('ResetPasswordPage (US-15)', () => {
  let fixture: ComponentFixture<ResetPasswordPage>;
  let http: HttpTestingController;
  let request: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResetPasswordPage);
  });

  afterEach(() => http.verify());

  it('without a token, the page sends me to ask for a link', async () => {
    await givenIOpenedThePage({ token: undefined });

    thenICanSee('This page opens from the link in the email');
    thenThereIsALinkTo('/forgot-password');
  });

  it('saves the new password with the token of the link, then asks me to log in', async () => {
    await givenIOpenedThePage({ token: 'tok-123' });

    await whenIChooseThePassword('second-password', { confirmation: 'second-password' });
    await whenTheServerAnswers();

    thenTheRequestWas({ token: 'tok-123', newPassword: 'second-password' });
    thenTheStatusSays('Your password is changed.');
    thenThereIsALinkTo('/login');
  });

  it('a link that no longer works says why and offers a new one', async () => {
    await givenIOpenedThePage({ token: 'old-token' });

    await whenIChooseThePassword('second-password', { confirmation: 'second-password' });
    await whenTheServerRefuses('RESET_LINK_INVALID');

    thenTheAlertSays('This link no longer works');
    thenThereIsALinkTo('/forgot-password');
  });

  it('two different passwords are not sent', async () => {
    await givenIOpenedThePage({ token: 'tok-123' });

    await whenIChooseThePassword('second-password', { confirmation: 'other-password' });

    thenNothingWasSent();
    thenICanSee('The two new passwords are not the same');
  });

  async function givenIOpenedThePage(query: { token: string | undefined }): Promise<void> {
    fixture.componentRef.setInput('token', query.token);
    await settle(fixture);
  }

  async function whenIChooseThePassword(password: string, typed: { confirmation: string }): Promise<void> {
    type('#reset-new', password);
    type('#reset-confirm', typed.confirmation);
    page().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  async function whenTheServerAnswers(): Promise<void> {
    request = http.expectOne(`${API}/auth/password-reset/confirm`);
    request.flush(ok('Password changed'));
    await settle(fixture);
  }

  async function whenTheServerRefuses(code: string): Promise<void> {
    request = http.expectOne(`${API}/auth/password-reset/confirm`);
    request.flush(fail('This reset link is unknown, already used or expired', code), { status: 400, statusText: 'Bad Request' });
    await settle(fixture);
  }

  function thenNothingWasSent(): void {
    http.expectNone(`${API}/auth/password-reset/confirm`);
  }

  function thenTheRequestWas(body: { token: string; newPassword: string }): void {
    expect(request.request.body).toEqual(body);
  }

  function thenTheStatusSays(text: string): void {
    expect(page().querySelector('[role="status"]')!.textContent).toContain(text);
  }

  function thenTheAlertSays(text: string): void {
    expect(page().querySelector('[role="alert"]')!.textContent).toContain(text);
  }

  function thenThereIsALinkTo(href: string): void {
    expect(Array.from(page().querySelectorAll('a')).map((a) => a.getAttribute('href'))).toContain(href);
  }

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function type(selector: string, value: string): void {
    const input = page().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }
});
