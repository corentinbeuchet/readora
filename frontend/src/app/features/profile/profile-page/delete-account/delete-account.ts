import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';

/**
 * Deleting my account (US-15). Behind a disclosure, and confirmed with the password: it cannot be undone. Afterwards the
 * browser forgets the session and goes home.
 */
@Component({
  selector: 'app-delete-account',
  imports: [FormField, FieldErrors, AriaInvalidDirective],
  templateUrl: './delete-account.html'
})
export class DeleteAccount {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly open = signal(false);
  protected readonly model = signal({ password: '' });
  protected readonly deleteForm = form(this.model, (path) => {
    required(path.password, { message: $localize`:@@profile.delete.passwordRequired:Type your password to confirm` });
  });
  protected readonly deleting = asyncAction($localize`:@@profile.delete.error:Your account could not be deleted. Please try again.`);

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.deleteForm, async (f) => {
      const deleted = await this.deleting.run(async () => {
        await firstValueFrom(this.auth.deleteAccount(f().value().password));
        return true;
      });
      if (deleted) {
        await this.router.navigateByUrl('/');
      }
    });
  }
}
