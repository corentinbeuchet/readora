import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, of, switchMap, timer } from 'rxjs';
import { CatalogApi } from '@app/core/api/catalog-api';
import { WorkSummary } from '@app/core/models/catalog';
import { TeamsApi } from '@app/core/api/teams-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { leadsTeam } from '@app/core/models/scanlation';
import { ExistingSeries, GENRE_PRESETS, UploadWizard } from '@app/features/upload/upload-studio-page/upload-wizard';
import { CoverPicker } from './cover-picker/cover-picker';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { WorkFactsFields } from '@app/shared/forms/work-facts-fields/work-facts-fields';
import { LoadError } from '@app/shared/ui/load-error';

const SIMILAR_DEBOUNCE_MS = 400;
const SIMILAR_MIN_LENGTH = 3;
const SIMILAR_RESULTS = 3;

/** Step 1: the series' details and cover, or what is being published into when the series already exists. */
@Component({
  selector: 'app-series-step',
  imports: [FieldErrors, AriaInvalidDirective, FormField, CoverPicker, WorkFactsFields, RouterLink, LoadError],
  templateUrl: './series-step.html',
  styleUrl: './series-step.scss'
})
export class SeriesStep {
  protected readonly wizard = inject(UploadWizard);
  protected readonly form = this.wizard.form;

  /** The existing series and team to publish into; `null` to create a series. */
  readonly existing = input<ExistingSeries | null>(null);

  private readonly auth = inject(AuthStore);
  private readonly catalogApi = inject(CatalogApi);
  private readonly canSeeTeams = computed(() => !this.existing() && this.auth.can('LIBRARY_USE'));
  private readonly myTeams = inject(TeamsApi).mineResource(this.canSeeTeams);
  protected readonly teamsLoading = computed(() => this.myTeams.status() === 'loading');
  protected readonly teamsError = computed(() => this.myTeams.error());
  /** Teams I lead: a new series belongs to one of them, which gets a task board for it. */
  protected readonly ledTeams = computed(() => (this.myTeams.hasValue() ? this.myTeams.value().filter(leadsTeam) : []));

  protected reloadTeams(): void {
    this.myTeams.reload();
  }

  /**
   * Series of the catalog whose title, other title or author matches the title being typed (US-12): the uploader
   * may be about to create a series Readora already has. Only a warning: two series may share a title.
   * The pause is a timer per title inside `switchMap` rather than `debounceTime`, which would still search for the
   * last title when the step closes (it emits its pending value when the source completes).
   */
  protected readonly similar = toSignal(
    toObservable(computed(() => (this.existing() ? '' : this.wizard.draft().title.trim()))).pipe(
      distinctUntilChanged(),
      switchMap((title) =>
        title.length < SIMILAR_MIN_LENGTH
          ? of<WorkSummary[]>([])
          : timer(SIMILAR_DEBOUNCE_MS).pipe(
              switchMap(() => this.catalogApi.suggest(title, SIMILAR_RESULTS)),
              catchError(() => of<WorkSummary[]>([]))
            )
      )
    ),
    { initialValue: [] }
  );

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
