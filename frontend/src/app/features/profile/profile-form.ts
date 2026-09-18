import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FieldTree, FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from '@app/core/api/profile-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { UserProfile } from '@app/core/models/readora.models';
import { apiErrorMessage, visibleErrors } from '@app/features/auth/auth-form.utils';

interface ProfileModel {
  displayName: string;
  bio: string;
  avatarUrl: string;
}

@Component({
  selector: 'app-profile-form',
  imports: [FormField],
  templateUrl: './profile-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileForm {
  private readonly profileApi = inject(ProfileApi);
  private readonly auth = inject(AuthStore);

  readonly profile = input.required<UserProfile>();
  readonly saved = output<UserProfile>();

  protected readonly model = signal<ProfileModel>({ displayName: '', bio: '', avatarUrl: '' });
  protected readonly profileForm = form(this.model, (path) => {
    required(path.displayName, { message: 'Display name is required' });
    maxLength(path.displayName, 100, { message: 'Display name must be at most 100 characters' });
    maxLength(path.bio, 1000, { message: 'Bio must be at most 1000 characters' });
    pattern(path.avatarUrl, /^(https?:\/\/\S+)?$/, { message: 'Avatar must be an http(s) URL' });
  });

  protected readonly status = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  protected readonly errorMessage = signal<string | null>(null);
  /** Id of the user the form was last seeded for. */
  private seededFor: string | null = null;

  constructor() {
    // Seed the form from the bound profile. A refreshed profile object (e.g. AuthStore reloading the
    // user after a checkout) must not overwrite what the user is typing: only a pristine form, or a
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

  protected errors(field: FieldTree<string>): string[] {
    return visibleErrors(field);
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
        this.saved.emit(updated);
        this.status.set('saved');
      } catch (error) {
        this.errorMessage.set(apiErrorMessage(error, 'Could not save your profile'));
        this.status.set('error');
      }
    });
  }
}
