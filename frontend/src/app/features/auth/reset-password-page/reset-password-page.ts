import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form, maxLength, minLength, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from '@app/core/api/auth-api';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@app/core/models/identity';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';

/** The page a reset link opens (US-15): choose the new password; every session of the account ends. */
@Component({
  selector: 'app-reset-password-page',
  imports: [FormField, FieldErrors, AriaInvalidDirective, RouterLink],
  templateUrl: './reset-password-page.html'
})
export class ResetPasswordPage {
  private readonly authApi = inject(AuthApi);

  /** `?token=` from the emailed link. */
  readonly token = input<string>();

  protected readonly model = signal({ newPassword: '', confirmPassword: '' });
  protected readonly resetForm = form(this.model, (path) => {
    required(path.newPassword, { message: $localize`:@@auth.reset.newRequired:Choose a new password` });
    minLength(path.newPassword, PASSWORD_MIN_LENGTH, {
      message: $localize`:@@auth.reset.newMin:The new password needs at least ${PASSWORD_MIN_LENGTH}:min: characters`
    });
    maxLength(path.newPassword, PASSWORD_MAX_LENGTH, {
      message: $localize`:@@auth.reset.newMax:The new password must be at most ${PASSWORD_MAX_LENGTH}:max: characters`
    });
    required(path.confirmPassword, { message: $localize`:@@auth.reset.confirmRequired:Type the new password again` });
    validate(path.confirmPassword, ({ value, valueOf }) =>
      value() === valueOf(path.newPassword)
        ? undefined
        : { kind: 'passwordMismatch', message: $localize`:@@auth.reset.mismatch:The two new passwords are not the same` }
    );
  });
  protected readonly resetting = asyncAction($localize`:@@auth.reset.error:Your password could not be changed. Please try again.`);
  protected readonly done = signal(false);

  constructor() {
    inject(SeoService).private_($localize`:@@auth.reset.seoTitle:Choose a new password`);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.resetForm, async (f) => {
      await this.resetting.run(async () => {
        await firstValueFrom(this.authApi.resetPassword({ token: this.token() ?? '', newPassword: f().value().newPassword }));
        this.done.set(true);
      });
    });
  }
}
