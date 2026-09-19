import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FieldTree, FormField, email, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { SeoService } from '@app/core/seo/seo.service';
import { visibleErrors } from './auth-form.utils';
import { asyncAction } from '@app/core/utils/async-action';

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

  protected readonly signingIn = asyncAction('Invalid email or password');

  constructor() {
    this.seo.private_('Log in');
  }

  protected errors(field: FieldTree<string>): string[] {
    return visibleErrors(field);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.signingIn.clearError();
    await submit(this.loginForm, async (f) => {
      await this.signingIn.run(async () => {
        await firstValueFrom(this.auth.login(f().value()));
        await this.router.navigateByUrl(this.returnUrl());
      });
    });
  }

  private returnUrl(): string {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  }
}
