import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, email, form, maxLength, minLength, pattern, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from './auth-form.utils';

interface RegisterModel {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-register-page',
  imports: [FieldErrors, AriaInvalidDirective, RouterLink, FormField],
  templateUrl: './register-page.html'
})
export class RegisterPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly model = signal<RegisterModel>({ email: '', username: '', password: '', confirmPassword: '' });
  protected readonly registerForm = form(this.model, (path) => {
    required(path.email, { message: 'Email is required' });
    email(path.email, { message: 'Enter a valid email address' });

    required(path.username, { message: 'Username is required' });
    minLength(path.username, USERNAME_MIN_LENGTH, { message: `Username must be at least ${USERNAME_MIN_LENGTH} characters` });
    maxLength(path.username, USERNAME_MAX_LENGTH, { message: `Username must be at most ${USERNAME_MAX_LENGTH} characters` });
    pattern(path.username, USERNAME_PATTERN, { message: 'Only letters, digits, "_", "." and "-" are allowed' });

    required(path.password, { message: 'Password is required' });
    minLength(path.password, PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
    maxLength(path.password, PASSWORD_MAX_LENGTH, { message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters` });

    required(path.confirmPassword, { message: 'Please confirm your password' });
    validate(path.confirmPassword, ({ value, valueOf }) =>
      value() === valueOf(path.password) ? undefined : { kind: 'passwordMismatch', message: 'Passwords do not match' }
    );
  });

  protected readonly registering = asyncAction('Could not create your account');

  constructor() {
    this.seo.private_('Create an account');
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.registering.clearError();
    await submit(this.registerForm, async (f) => {
      await this.registering.run(async () => {
        const { email, username, password } = f().value();
        await firstValueFrom(this.auth.register({ email, username, password }));
        await this.router.navigateByUrl('/profile');
      });
    });
  }
}
