import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { TeamsApi } from '@app/core/api/teams-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { EmptyState } from '@app/shared/ui/empty-state/empty-state';
import { LoadError } from '@app/shared/ui/load-error';
import { TeamPanel } from './team-panel/team-panel';

/** The scanlation workspace (US-12): the teams I belong to with their task boards, and a new-team form. */
@Component({
  selector: 'app-my-teams-page',
  imports: [LoadError, EmptyState, FieldErrors, AriaInvalidDirective, FormField, HasPermissionDirective, TeamPanel],
  templateUrl: './my-teams-page.html',
  styleUrl: './my-teams-page.scss'
})
export class MyTeamsPage {
  private readonly api = inject(TeamsApi);
  private readonly auth = inject(AuthStore);

  private readonly canView = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly teams = this.api.mineResource(this.canView);
  protected readonly creating = asyncAction();
  protected readonly model = signal({ name: '', description: '' });
  protected readonly newTeamForm = form(this.model, (path) => {
    required(path.name, { message: $localize`:@@scanlation.teams.new.nameRequired:Give your team a name` });
    maxLength(path.name, 255);
    maxLength(path.description, 1000);
  });

  constructor() {
    inject(SeoService).private_($localize`:@@scanlation.teams.seoTitle:My teams`);
  }

  /** Creates the team (I become its leader) and shows it first in the list. */
  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.creating.clearError();
    await submit(this.newTeamForm, async (f) => {
      const { name, description } = f().value();
      await this.creating.run(async () => {
        const team = await firstValueFrom(this.api.create({ name: name.trim(), description: description.trim() }));
        this.teams.update((teams) => [team, ...teams]);
        this.model.set({ name: '', description: '' });
        f().reset();
      });
    });
  }
}
