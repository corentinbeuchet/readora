import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { CatalogApi } from '@app/core/api/catalog-api';
import { TeamsApi } from '@app/core/api/teams-api';
import { WorkSummary } from '@app/core/models/catalog';
import { MyTeam, SCANLATION_ROLE_LABELS, leadsTeam, publishesForTeam } from '@app/core/models/scanlation';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { InviteMember } from './invite-member/invite-member';
import { TeamRoster } from './team-roster/team-roster';

const SEARCH_RESULTS = 5;

/** One of my teams: its task boards and members, and for its leaders the tools to add a series or invite a member. */
@Component({
  selector: 'app-team-panel',
  imports: [RouterLink, FormField, FieldErrors, AriaInvalidDirective, InviteMember, TeamRoster],
  templateUrl: './team-panel.html',
  styleUrl: './team-panel.scss'
})
export class TeamPanel {
  private readonly teamsApi = inject(TeamsApi);
  private readonly catalogApi = inject(CatalogApi);

  readonly team = input.required<MyTeam>();
  /** The team gained a series, or I left it: the list should be loaded again. */
  readonly changed = output();

  protected readonly leads = computed(() => leadsTeam(this.team()));
  protected readonly canPublish = computed(() => publishesForTeam(this.team()));
  protected readonly myRoles = computed(() => this.team().myRoles.map((role) => SCANLATION_ROLE_LABELS[role]));
  private readonly boardWorkIds = computed(() => new Set(this.team().boards.map((board) => board.work.id)));

  protected readonly searching = asyncAction();
  protected readonly searchModel = signal({ text: '' });
  protected readonly searchForm = form(this.searchModel, (path) => {
    required(path.text, { message: $localize`:@@scanlation.teams.series.textRequired:Type the title of a series` });
  });
  /** `null` until a search ran. Series the team already has are left out. */
  protected readonly found = signal<WorkSummary[] | null>(null);
  protected readonly adding = asyncAction();

  protected async search(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.searchForm, async (f) => {
      await this.searching.run(async () => {
        const works = await firstValueFrom(this.catalogApi.suggest(f().value().text.trim(), SEARCH_RESULTS));
        this.found.set(works.filter((work) => !this.boardWorkIds().has(work.id)));
      });
    });
  }

  protected async addSeries(work: WorkSummary): Promise<void> {
    await this.adding.run(async () => {
      await firstValueFrom(this.teamsApi.addSeries(this.team().id, work.id));
      this.found.set(null);
      this.changed.emit();
    }, { key: work.id });
  }
}
