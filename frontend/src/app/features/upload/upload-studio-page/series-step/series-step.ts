import { Component, computed, inject, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { TeamsApi } from '@app/core/api/teams-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { leadsTeam } from '@app/core/models/scanlation';
import { ExistingSeries, GENRE_PRESETS, UploadWizard } from '@app/features/upload/upload-studio-page/upload-wizard';
import { CoverPicker } from './cover-picker/cover-picker';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { WorkFactsFields } from '@app/shared/forms/work-facts-fields/work-facts-fields';

/** Step 1: the series' details and cover, or what is being published into when the series already exists. */
@Component({
  selector: 'app-series-step',
  imports: [FieldErrors, AriaInvalidDirective, FormField, CoverPicker, WorkFactsFields],
  templateUrl: './series-step.html',
  styleUrl: './series-step.scss'
})
export class SeriesStep {
  protected readonly wizard = inject(UploadWizard);
  protected readonly form = this.wizard.form;

  /** The existing series and team to publish into; `null` to create a series. */
  readonly existing = input<ExistingSeries | null>(null);

  private readonly auth = inject(AuthStore);
  private readonly canSeeTeams = computed(() => !this.existing() && this.auth.can('PROJECT_VIEW'));
  private readonly myTeams = inject(TeamsApi).mineResource(this.canSeeTeams);
  /** Teams I lead: a new series can belong to one of them instead of getting a team of its own. */
  protected readonly ledTeams = computed(() => (this.myTeams.hasValue() ? this.myTeams.value().filter(leadsTeam) : []));

  /** Preset genres plus the custom ones added, each with its pressed state (computed once, not per template call). */
  protected readonly genres = computed(() => {
    const selected = new Set(this.wizard.draft().genres);
    const custom = this.wizard.draft().genres.filter((g) => !GENRE_PRESETS.includes(g));
    return [...GENRE_PRESETS, ...custom].map((name) => ({ name, selected: selected.has(name) }));
  });

  protected addGenre(input: HTMLInputElement): void {
    if (this.wizard.addGenre(input.value)) {
      input.value = '';
    }
  }
}
