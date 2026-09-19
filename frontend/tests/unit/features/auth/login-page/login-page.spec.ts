import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { LoginPage } from '@app/features/auth/login-page/login-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { mockAuthResponse } from '../../../core/auth/auth-fixtures';
import { API, fail, provideHttpTesting } from '../../../test-utils';

interface Credentials {
  email: string;
  password: string;
}

describe('LoginPage (Signal Forms)', () => {
  let fixture: ComponentFixture<LoginPage>;
  let http: HttpTestingController;
  let router: Router;
  let store: AuthStore;
  let loginSpy: ReturnType<typeof vi.spyOn>;
  let loginRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([{ path: '**', component: LoginPage }]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => http.verify());

  it('shows validation messages and does not call the API when the form is invalid', async () => {
    givenIAmOnTheLoginPage();

    await whenISubmitTheForm();

    thenAFieldErrorSays('Email is required');
    thenAFieldErrorSays('Password is required');
    thenNoElementIdIsRepeated();
    thenTheEmailErrorSays('Email is required');
    thenTheEmailFieldIsDescribedByItsError();
    thenNoSignInRequestWasSent();

    whenITypeMyEmail('not-an-email');

    thenICanSee('Enter a valid email address');
    thenTheEmailFieldIsInvalid();
  });

  it('submits valid credentials through AuthStore and redirects to returnUrl', async () => {
    givenIAmOnTheLoginPage();
    givenIHaveEnteredMyCredentials({ email: 'reader@readora.test', password: 'Sup3rSecret!' });

    await whenISubmitAndTheServerAcceptsThem();

    thenTheSignInRequestSent({ email: 'reader@readora.test', password: 'Sup3rSecret!' });
    thenTheStoreSignedInWith({ email: 'reader@readora.test', password: 'Sup3rSecret!' });
    thenIAmSignedIn();
    thenIAmOn('/');
  });

  it.each([
    ['/works/42?tab=chapters', '/works/42?tab=chapters'],
    ['//evil.example/phish', '/'],
    ['https://evil.example', '/']
  ])('after login follows returnUrl %s only when it is a same-site path', async (returnUrl, expected) => {
    givenIAmOnTheLoginPage({ returnUrl });
    givenIHaveEnteredMyCredentials({ email: 'reader@readora.test', password: 'Sup3rSecret!' });

    await whenISubmitAndTheServerAcceptsThem();

    thenIAmOn(expected);
  });

  it('shows the API error message when credentials are rejected', async () => {
    givenIAmOnTheLoginPage();
    givenIHaveEnteredMyCredentials({ email: 'reader@readora.test', password: 'wrong-password' });

    await whenISubmitAndTheServerRejectsThem('Invalid email or password');

    thenTheAlertSays('Invalid email or password');
    thenIAmNotSignedIn();
  });

  function givenIAmOnTheLoginPage(inputs: { returnUrl?: string } = {}): void {
    loginSpy = vi.spyOn(store, 'login');
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    if (inputs.returnUrl !== undefined) fixture.componentRef.setInput('returnUrl', inputs.returnUrl);
  }

  function givenIHaveEnteredMyCredentials(credentials: Credentials): void {
    typeInto('#login-email', credentials.email);
    typeInto('#login-password', credentials.password);
  }

  async function whenISubmitTheForm(): Promise<void> {
    await submit();
  }

  function whenITypeMyEmail(email: string): void {
    typeInto('#login-email', email);
  }

  async function whenISubmitAndTheServerAcceptsThem(): Promise<void> {
    const pending = submit();
    loginRequest = http.expectOne(`${API}/auth/login`);
    loginRequest.flush(mockAuthResponse());
    await pending;
  }

  async function whenISubmitAndTheServerRejectsThem(message: string): Promise<void> {
    const pending = submit();
    loginRequest = http.expectOne(`${API}/auth/login`);
    loginRequest.flush(fail(message), { status: 401, statusText: 'Unauthorized' });
    await pending;
  }

  function thenAFieldErrorSays(message: string): void {
    const errors = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.field-error')).map((e) => e.textContent?.trim());
    expect(errors).toContain(message);
  }

  /** aria-describedby targets are unique containers, never ids repeated inside @for. */
  function thenNoElementIdIsRepeated(): void {
    const ids = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('[id]')).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  }

  function thenTheEmailErrorSays(message: string): void {
    expect(el('#login-email-error').textContent).toContain(message);
  }

  function thenTheEmailFieldIsDescribedByItsError(): void {
    expect(el('#login-email').getAttribute('aria-describedby')).toBe('login-email-error');
  }

  function thenTheEmailFieldIsInvalid(): void {
    expect(el('#login-email').getAttribute('aria-invalid')).toBe('true');
  }

  function thenNoSignInRequestWasSent(): void {
    http.expectNone(`${API}/auth/login`);
  }

  function thenTheSignInRequestSent(credentials: Credentials): void {
    expect(loginRequest.request.body).toEqual(credentials);
  }

  function thenTheStoreSignedInWith(credentials: Credentials): void {
    expect(loginSpy).toHaveBeenCalledWith(credentials);
  }

  function thenIAmSignedIn(): void {
    expect(store.isAuthenticated()).toBe(true);
  }

  function thenIAmNotSignedIn(): void {
    expect(store.isAuthenticated()).toBe(false);
  }

  function thenIAmOn(url: string): void {
    expect(router.url).toBe(url);
  }

  function thenTheAlertSays(message: string): void {
    expect(el('[role="alert"]').textContent).toContain(message);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function typeInto(selector: string, value: string): void {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  async function submit(): Promise<void> {
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function el<T extends HTMLElement>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }
});
