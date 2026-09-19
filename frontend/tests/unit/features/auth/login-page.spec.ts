import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { LoginPage } from '@app/features/auth/login-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { environment } from '../../../../src/environments/environment';
import { mockAuthResponse } from '../../core/auth/auth-fixtures';

describe('LoginPage (Signal Forms)', () => {
  let fixture: ComponentFixture<LoginPage>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([{ path: '**', component: LoginPage }]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const el = <T extends HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;

  function type(selector: string, value: string): void {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  async function submitForm(): Promise<void> {
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows validation messages and does not call the API when the form is invalid', async () => {
    await submitForm();
    const errors = Array.from(fixture.nativeElement.querySelectorAll('.field-error')).map((e) => (e as HTMLElement).textContent?.trim());
    expect(errors).toContain('Email is required');
    expect(errors).toContain('Password is required');
    // aria-describedby targets are unique containers, never ids repeated inside @for.
    const ids = Array.from(fixture.nativeElement.querySelectorAll('[id]')).map((e) => (e as HTMLElement).id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(el('#login-email-error').textContent).toContain('Email is required');
    expect(el('#login-email').getAttribute('aria-describedby')).toBe('login-email-error');
    http.expectNone(`${environment.apiUrl}/auth/login`);

    type('#login-email', 'not-an-email');
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address');
    expect(el('#login-email').getAttribute('aria-invalid')).toBe('true');
  });

  it('submits valid credentials through AuthStore and redirects to returnUrl', async () => {
    const store = TestBed.inject(AuthStore);
    const loginSpy = vi.spyOn(store, 'login');
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    type('#login-email', 'reader@readora.test');
    type('#login-password', 'Sup3rSecret!');
    const pending = submitForm();

    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.body).toEqual({ email: 'reader@readora.test', password: 'Sup3rSecret!' });
    req.flush(mockAuthResponse());
    await pending;

    expect(loginSpy).toHaveBeenCalledWith({ email: 'reader@readora.test', password: 'Sup3rSecret!' });
    expect(store.isAuthenticated()).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it.each([
    ['/works/42?tab=chapters', '/works/42?tab=chapters'],
    ['//evil.example/phish', '/'],
    ['https://evil.example', '/']
  ])('after login follows returnUrl %s only when it is a same-site path', async (returnUrl, expected) => {
    fixture.componentRef.setInput('returnUrl', returnUrl);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    type('#login-email', 'reader@readora.test');
    type('#login-password', 'Sup3rSecret!');
    const pending = submitForm();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(mockAuthResponse());
    await pending;

    expect(navigateSpy).toHaveBeenCalledWith(expected);
  });

  it('shows the API error message when credentials are rejected', async () => {
    type('#login-email', 'reader@readora.test');
    type('#login-password', 'wrong-password');
    const pending = submitForm();

    http.expectOne(`${environment.apiUrl}/auth/login`).flush(
      { success: false, data: null, error: 'Invalid email or password' },
      { status: 401, statusText: 'Unauthorized' }
    );
    await pending;

    expect(el('[role="alert"]').textContent).toContain('Invalid email or password');
    expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(false);
  });
});
