import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormField,
  email,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
  validate
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN
} from './auth-form.utils';

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
    required(path.email, { message: $localize`:@@auth.register.emailRequired:Email is required` });
    email(path.email, { message: $localize`:@@auth.register.emailInvalid:Enter a valid email address` });

    required(path.username, { message: $localize`:@@auth.register.usernameRequired:Username is required` });
    minLength(path.username, USERNAME_MIN_LENGTH, {
      message: $localize`:@@auth.register.usernameMin:Username must be at least ${USERNAME_MIN_LENGTH}:min: characters`
    });
    maxLength(path.username, USERNAME_MAX_LENGTH, {
      message: $localize`:@@auth.register.usernameMax:Username must be at most ${USERNAME_MAX_LENGTH}:max: characters`
    });
    pattern(path.username, USERNAME_PATTERN, {
      message: $localize`:@@auth.register.usernamePattern:Only letters, digits, "_", "." and "-" are allowed`
    });

    required(path.password, { message: $localize`:@@auth.register.passwordRequired:Password is required` });
    minLength(path.password, PASSWORD_MIN_LENGTH, {
      message: $localize`:@@auth.register.passwordMin:Password must be at least ${PASSWORD_MIN_LENGTH}:min: characters`
    });
    maxLength(path.password, PASSWORD_MAX_LENGTH, {
      message: $localize`:@@auth.register.passwordMax:Password must be at most ${PASSWORD_MAX_LENGTH}:max: characters`
    });

    required(path.confirmPassword, { message: $localize`:@@auth.register.confirmRequired:Please confirm your password` });
    validate(path.confirmPassword, ({ value, valueOf }) =>
      value() === valueOf(path.password) ? undefined : { kind: 'passwordMismatch', message: $localize`:@@auth.register.mismatch:Passwords do not match` }
    );
  });

  protected readonly registering = asyncAction($localize`:@@auth.register.error:Could not create your account`);

  constructor() {
    this.seo.private_($localize`:@@auth.register.seoTitle:Create an account`);
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
