import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordPage } from '@app/features/auth/forgot-password-page/forgot-password-page';
import { API, ok, provideHttpTesting, settle } from '../../../test-utils';

describe('ForgotPasswordPage (US-15)', () => {
  let fixture: ComponentFixture<ForgotPasswordPage>;
  let http: HttpTestingController;
  let request: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ForgotPasswordPage);
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('an address that is not an email is not sent', async () => {
    await whenIAskForALinkFor('camille');

    thenNothingWasSent();
    thenICanSee('Enter a valid email address');
  });

  it('asks for a link in the site language and says where it went, without saying whether an account exists', async () => {
    await whenIAskForALinkFor(' camille@readora.test ');
    await whenTheServerAnswers();

    thenTheRequestWas({ email: 'camille@readora.test', language: 'en' });
    thenTheStatusSays('If an account uses camille@readora.test, a link to choose a new password is on its way.');
  });

  async function whenIAskForALinkFor(address: string): Promise<void> {
    const input = page().querySelector<HTMLInputElement>('#forgot-email')!;
    input.value = address;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    page().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  async function whenTheServerAnswers(): Promise<void> {
    request = http.expectOne(`${API}/auth/password-reset`);
    request.flush(ok('If an account uses this email, a reset link is on its way'));
    await settle(fixture);
  }

  function thenNothingWasSent(): void {
    http.expectNone(`${API}/auth/password-reset`);
  }

  function thenTheRequestWas(body: { email: string; language: string }): void {
    expect(request.request.body).toEqual(body);
  }

  function thenTheStatusSays(text: string): void {
    expect(page().querySelector('[role="status"]')!.textContent!.replace(/\s+/g, ' ')).toContain(text);
  }

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }
});
