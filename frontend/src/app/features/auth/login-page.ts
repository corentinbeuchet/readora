import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FieldTree, FormField, email, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { apiErrorMessage, visibleErrors } from './auth-form.utils';

interface LoginModel {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login-page',
  imports: [RouterLink, FormField],
  templateUrl: './login-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  protected readonly model = signal<LoginModel>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email, { message: 'Email is required' });
    email(path.email, { message: 'Enter a valid email address' });
    required(path.password, { message: 'Password is required' });
  });

  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  constructor() {
    this.seo.private_('Log in');
  }

  protected errors(field: FieldTree<string>): string[] {
    return visibleErrors(field);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitError.set(null);
    await submit(this.loginForm, async (f) => {
      this.submitting.set(true);
      try {
        await firstValueFrom(this.auth.login(f().value()));
        await this.router.navigateByUrl(this.returnUrl());
      } catch (error) {
        this.submitError.set(apiErrorMessage(error, 'Invalid email or password'));
      } finally {
        this.submitting.set(false);
      }
    });
  }

  private returnUrl(): string {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  }
}
