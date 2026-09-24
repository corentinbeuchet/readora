import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ChangePassword } from '@app/features/profile/profile-page/change-password/change-password';
import { AuthStore } from '@app/core/auth/auth-store';
import { mockAuthResponse } from '../../../../core/auth/auth-fixtures';
import { API, fail, provideHttpTesting, settle } from '../../../../test-utils';

interface Typed {
  current: string;
  next: string;
  confirm: string;
}

describe('ChangePassword (US-15)', () => {
  let fixture: ComponentFixture<ChangePassword>;
  let http: HttpTestingController;
  let request: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangePassword],
      providers: [...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ChangePassword);
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('two different new passwords are not sent', async () => {
    await whenISubmit({ current: 'first-password', next: 'second-password', confirm: 'other-password' });

    thenNothingWasSent();
    thenICanSee('The two new passwords are not the same');
  });

  it('a changed password keeps me signed in with the new session and empties the form', async () => {
    await whenISubmit({ current: 'first-password', next: 'second-password', confirm: 'second-password' });
    await whenTheServerAnswersWithTheSession('jwt-after-change');

    thenTheRequestWas({ currentPassword: 'first-password', newPassword: 'second-password' });
    thenMySessionTokenIs('jwt-after-change');
    thenTheStatusSays('Password changed. Your other devices are signed out.');
    thenTheFieldsAreEmpty();
  });

  it('a wrong current password is explained and the form keeps what I typed', async () => {
    await whenISubmit({ current: 'not-the-password', next: 'second-password', confirm: 'second-password' });
    await whenTheServerRefuses('WRONG_PASSWORD');

    thenTheAlertSays('Your current password is not right.');
    thenTheStatusSays('');
    thenTheNewPasswordFieldHolds('second-password');
  });

  async function whenISubmit(typed: Typed): Promise<void> {
    type('#pw-current', typed.current);
    type('#pw-new', typed.next);
    type('#pw-confirm', typed.confirm);
    page().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  async function whenTheServerAnswersWithTheSession(accessToken: string): Promise<void> {
    request = http.expectOne(`${API}/auth/password`);
    request.flush(mockAuthResponse({ accessToken }));
    await settle(fixture);
  }

  async function whenTheServerRefuses(code: string): Promise<void> {
    request = http.expectOne(`${API}/auth/password`);
    request.flush(fail('The current password is wrong', code), { status: 400, statusText: 'Bad Request' });
    await settle(fixture);
  }

  function thenNothingWasSent(): void {
    http.expectNone(`${API}/auth/password`);
  }

  function thenTheRequestWas(body: { currentPassword: string; newPassword: string }): void {
    expect(request.request.body).toEqual(body);
    expect(request.request.withCredentials).toBe(true);
  }

  function thenMySessionTokenIs(token: string): void {
    expect(TestBed.inject(AuthStore).accessToken()).toBe(token);
  }

  function thenTheStatusSays(text: string): void {
    expect(page().querySelector('[role="status"]')!.textContent!.trim()).toBe(text);
  }

  function thenTheAlertSays(text: string): void {
    expect(page().querySelector('[role="alert"]')!.textContent).toContain(text);
  }

  function thenTheFieldsAreEmpty(): void {
    expect(['#pw-current', '#pw-new', '#pw-confirm'].map((id) => page().querySelector<HTMLInputElement>(id)!.value)).toEqual(['', '', '']);
  }

  function thenTheNewPasswordFieldHolds(value: string): void {
    expect(page().querySelector<HTMLInputElement>('#pw-new')!.value).toBe(value);
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
