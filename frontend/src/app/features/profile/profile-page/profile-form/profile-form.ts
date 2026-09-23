import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from '@app/core/api/profile-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { UserProfile } from '@app/core/models/identity';
import { apiErrorMessage } from '@app/core/api/api-client';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';

interface ProfileModel {
  displayName: string;
  bio: string;
  avatarUrl: string;
}

@Component({
  selector: 'app-profile-form',
  imports: [FieldErrors, AriaInvalidDirective, FormField],
  templateUrl: './profile-form.html'
})
export class ProfileForm {
  private readonly profileApi = inject(ProfileApi);
  private readonly auth = inject(AuthStore);

  readonly profile = input.required<UserProfile>();

  protected readonly model = signal<ProfileModel>({ displayName: '', bio: '', avatarUrl: '' });
  protected readonly profileForm = form(this.model, (path) => {
    required(path.displayName, { message: $localize`:@@profile.form.displayNameRequired:Display name is required` });
    maxLength(path.displayName, 100, { message: $localize`:@@profile.form.displayNameMax:Display name must be at most 100 characters` });
    maxLength(path.bio, 1000, { message: $localize`:@@profile.form.bioMax:Bio must be at most 1000 characters` });
    pattern(path.avatarUrl, /^(https?:\/\/\S+)?$/, { message: $localize`:@@profile.form.avatarPattern:Avatar must be an http(s) URL` });
  });

  protected readonly status = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  protected readonly errorMessage = signal<string | null>(null);
  /** Id of the user the form was last seeded for. */
  private seededFor: string | null = null;

  constructor() {
    // Seed the form from the bound profile. A refreshed profile object (e.g. AuthStore reloading the
    // user after a token refresh) must not overwrite what the user is typing: only a pristine form, or a
    // different user, is re-seeded.
    effect(() => {
      const p = this.profile();
      untracked(() => {
        if (p.id === this.seededFor && this.profileForm().dirty()) {
          return;
        }
        this.seededFor = p.id;
        this.profileForm().reset({ displayName: p.displayName, bio: p.bio ?? '', avatarUrl: p.avatarUrl ?? '' });
      });
    });
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    await submit(this.profileForm, async (f) => {
      this.status.set('saving');
      try {
        const { displayName, bio, avatarUrl } = f().value();
        const updated = await firstValueFrom(this.profileApi.update({ displayName, bio, avatarUrl: avatarUrl || null }));
        // Saved: the form is pristine again, so the effect re-seeds it from the server's version.
        this.profileForm().reset();
        this.auth.setUser(updated);
        this.status.set('saved');
      } catch (error) {
        this.errorMessage.set(apiErrorMessage(error, $localize`:@@profile.form.saveError:Could not save your profile`));
        this.status.set('error');
      }
    });
  }
}
