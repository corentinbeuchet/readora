import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FieldTree, FormField, email, form, maxLength, minLength, pattern, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  apiErrorMessage,
  visibleErrors
} from './auth-form.utils';

interface RegisterModel {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-register-page',
  imports: [RouterLink, FormField],
  templateUrl: './register-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
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

    required(path.confirmPassword, { message: 'Please confirm your password' });
    validate(path.confirmPassword, ({ value, valueOf }) =>
      value() === valueOf(path.password) ? undefined : { kind: 'passwordMismatch', message: 'Passwords do not match' }
    );
  });

  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  constructor() {
    this.seo.private_('Create an account');
  }

  protected errors(field: FieldTree<string>): string[] {
    return visibleErrors(field);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitError.set(null);
    await submit(this.registerForm, async (f) => {
      this.submitting.set(true);
      try {
        const { email, username, password } = f().value();
        await firstValueFrom(this.auth.register({ email, username, password }));
        await this.router.navigateByUrl('/profile');
      } catch (error) {
        this.submitError.set(apiErrorMessage(error, 'Could not create your account'));
      } finally {
        this.submitting.set(false);
      }
    });
  }
}
