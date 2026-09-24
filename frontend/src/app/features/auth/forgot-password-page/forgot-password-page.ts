import { Component, LOCALE_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from '@app/core/api/auth-api';
import { siteLocale } from '@app/core/i18n/site-locales';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';

/** Forgot my password (US-15): a reset link goes to the email, if an account uses it (the page never says which). */
@Component({
  selector: 'app-forgot-password-page',
  imports: [FormField, FieldErrors, AriaInvalidDirective, RouterLink],
  templateUrl: './forgot-password-page.html'
})
export class ForgotPasswordPage {
  private readonly authApi = inject(AuthApi);
  private readonly language = siteLocale(inject(LOCALE_ID)).code === 'fr' ? 'fr' : 'en';

  protected readonly model = signal({ email: '' });
  protected readonly requestForm = form(this.model, (path) => {
    required(path.email, { message: $localize`:@@auth.forgot.emailRequired:Email is required` });
    email(path.email, { message: $localize`:@@auth.forgot.emailInvalid:Enter a valid email address` });
  });
  protected readonly sending = asyncAction($localize`:@@auth.forgot.error:The link could not be sent. Please try again.`);
  /** The address the link went to, once sent. */
  protected readonly sentTo = signal<string | null>(null);

  constructor() {
    inject(SeoService).private_($localize`:@@auth.forgot.seoTitle:Forgot your password`);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.requestForm, async (f) => {
      const address = f().value().email.trim();
      await this.sending.run(async () => {
        await firstValueFrom(this.authApi.requestPasswordReset({ email: address, language: this.language }));
        this.sentTo.set(address);
      });
    });
  }
}
