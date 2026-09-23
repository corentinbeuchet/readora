import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { CatalogApi } from '@app/core/api/catalog-api';
import { TeamsApi } from '@app/core/api/teams-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { WorkSummary } from '@app/core/models/catalog';
import { MyTeam, leadsTeam, publishesForTeam } from '@app/core/models/scanlation';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { WorkCard } from '@app/shared/ui/work-card/work-card';
import { UploadWizard } from '@app/features/upload/upload-studio-page/upload-wizard';

const SEARCH_RESULTS = 8;

/** How one of my teams can publish into a found series: it already works on it, or I lead it and can add it. */
interface PublishOption {
  team: MyTeam;
  onSeries: boolean;
}

/**
 * First step of the upload studio (`/upload`): find the series in the catalog before anything is typed, so a
 * series is not created twice and a team knows it adds its own version of a series other teams may translate.
 * Picking a series opens the studio for that series and team (`?workId=&teamId=`); "Create a new series" opens
 * the new-series form (`?create=series`). The search text lives in the wizard, so it survives the round trip.
 */
@Component({
  selector: 'app-which-series-step',
  imports: [FormField, FieldErrors, AriaInvalidDirective, WorkCard, RouterLink],
  templateUrl: './which-series-step.html',
  styleUrl: './which-series-step.scss'
})
export class WhichSeriesStep {
  private readonly wizard = inject(UploadWizard);
  private readonly catalogApi = inject(CatalogApi);
  private readonly teamsApi = inject(TeamsApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);

  protected readonly searchForm = form(this.wizard.seriesSearch, (path) => {
    required(path.text, { message: $localize`:@@upload.which.textRequired:Type the title of the series` });
  });
  protected readonly searching = asyncAction();
  protected readonly adding = asyncAction();
  /** `null` until a search ran. */
  private readonly found = signal<WorkSummary[] | null>(null);
  protected readonly searchedText = signal('');

  private readonly canSeeTeams = computed(() => this.auth.can('LIBRARY_USE'));
  private readonly myTeams = this.teamsApi.mineResource(this.canSeeTeams);
  /** Teams I can publish for (leaders and quality checkers). */
  private readonly publishingTeams = computed(() => (this.myTeams.hasValue() ? this.myTeams.value().filter(publishesForTeam) : []));
  protected readonly teamsLoaded = computed(() => !this.canSeeTeams() || this.myTeams.hasValue());
  protected readonly hasPublishingTeam = computed(() => this.publishingTeams().length > 0);

  /** Each found series with the teams of mine that can publish into it (computed once, not per row call). */
  protected readonly results = computed(() => {
    const found = this.found();
    if (found === null) return null;
    return found.map((work) => ({
      work,
      options: this.publishingTeams()
        .map((team): PublishOption => ({ team, onSeries: team.boards.some((board) => board.work.id === work.id) }))
        .filter((option) => option.onSeries || leadsTeam(option.team))
    }));
  });

  protected async search(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.searchForm, async (f) => {
      const text = f().value().text.trim();
      await this.searching.run(async () => {
        this.found.set(await firstValueFrom(this.catalogApi.suggest(text, SEARCH_RESULTS)));
        this.searchedText.set(text);
      });
    });
  }

  /** Opens the studio for this series and team, adding the series to the team first when it is not on it yet. */
  protected async publishInto(work: WorkSummary, option: PublishOption): Promise<void> {
    await this.adding.run(
      async () => {
        if (!option.onSeries) {
          await firstValueFrom(this.teamsApi.addSeries(option.team.id, work.id));
        }
        this.wizard.goTo('manga');
        await this.router.navigate(['/upload'], { queryParams: { workId: work.id, teamId: option.team.id } });
      },
      { key: `${work.id}:${option.team.id}` }
    );
  }

  /** The new-series form, with the searched text as its title when none was typed yet. */
  protected async createNew(): Promise<void> {
    if (!this.wizard.form.title().value().trim()) {
      this.wizard.form.title().value.set(this.wizard.seriesSearch().text.trim());
    }
    this.wizard.goTo('manga');
    await this.router.navigate(['/upload'], { queryParams: { create: 'series' } });
  }
}
