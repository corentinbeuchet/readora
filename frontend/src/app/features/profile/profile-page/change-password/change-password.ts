import { Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, minLength, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@app/core/models/identity';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';

interface PasswordModel {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY: PasswordModel = { currentPassword: '', newPassword: '', confirmPassword: '' };

/** Changing my password (US-15): the current one proves it is me; my other devices are signed out. */
@Component({
  selector: 'app-change-password',
  imports: [FormField, FieldErrors, AriaInvalidDirective],
  templateUrl: './change-password.html'
})
export class ChangePassword {
  private readonly auth = inject(AuthStore);

  protected readonly model = signal<PasswordModel>({ ...EMPTY });
  protected readonly passwordForm = form(this.model, (path) => {
    required(path.currentPassword, { message: $localize`:@@profile.password.currentRequired:Type your current password` });
    required(path.newPassword, { message: $localize`:@@profile.password.newRequired:Choose a new password` });
    minLength(path.newPassword, PASSWORD_MIN_LENGTH, {
      message: $localize`:@@profile.password.newMin:The new password needs at least ${PASSWORD_MIN_LENGTH}:min: characters`
    });
    maxLength(path.newPassword, PASSWORD_MAX_LENGTH, {
      message: $localize`:@@profile.password.newMax:The new password must be at most ${PASSWORD_MAX_LENGTH}:max: characters`
    });
    required(path.confirmPassword, { message: $localize`:@@profile.password.confirmRequired:Type the new password again` });
    validate(path.confirmPassword, ({ value, valueOf }) =>
      value() === valueOf(path.newPassword)
        ? undefined
        : { kind: 'passwordMismatch', message: $localize`:@@profile.password.mismatch:The two new passwords are not the same` }
    );
  });
  protected readonly changing = asyncAction($localize`:@@profile.password.error:Your password could not be changed. Please try again.`);
  /** Announced once the change went through (the form is emptied). */
  protected readonly done = signal('');

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.done.set('');
    await submit(this.passwordForm, async (f) => {
      const { currentPassword, newPassword } = f().value();
      const changed = await this.changing.run(async () => {
        await firstValueFrom(this.auth.changePassword({ currentPassword, newPassword }));
        return true;
      });
      if (changed) {
        this.passwordForm().reset({ ...EMPTY });
        this.done.set($localize`:@@profile.password.done:Password changed. Your other devices are signed out.`);
      }
    });
  }
}
