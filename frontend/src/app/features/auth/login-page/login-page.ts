import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';

interface LoginModel {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login-page',
  imports: [FieldErrors, AriaInvalidDirective, RouterLink, FormField],
  templateUrl: './login-page.html'
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  /** `?returnUrl=` set by the auth guards; only same-site paths are followed. */
  readonly returnUrl = input<string>();
  private readonly safeReturnUrl = computed(() => {
    const url = this.returnUrl();
    return url?.startsWith('/') && !url.startsWith('//') ? url : '/';
  });

  protected readonly model = signal<LoginModel>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email, { message: 'Email is required' });
    email(path.email, { message: 'Enter a valid email address' });
    required(path.password, { message: 'Password is required' });
  });

  protected readonly signingIn = asyncAction('Invalid email or password');

  constructor() {
    this.seo.private_('Log in');
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.signingIn.clearError();
    await submit(this.loginForm, async (f) => {
      await this.signingIn.run(async () => {
        await firstValueFrom(this.auth.login(f().value()));
        await this.router.navigateByUrl(this.safeReturnUrl());
      });
    });
  }
}
