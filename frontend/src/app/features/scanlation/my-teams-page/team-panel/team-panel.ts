import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { CatalogApi } from '@app/core/api/catalog-api';
import { ScanlationApi } from '@app/core/api/scanlation-api';
import { TeamsApi } from '@app/core/api/teams-api';
import { WorkSummary } from '@app/core/models/catalog';
import { MyTeam, SCANLATION_ROLE_LABELS, leadsTeam, publishesForTeam } from '@app/core/models/scanlation';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { Icon } from '@app/shared/ui/icon/icon';
import { InviteMember } from './invite-member/invite-member';
import { TeamRoster } from './team-roster/team-roster';

const SEARCH_RESULTS = 5;
/** Series listed per page of a panel; a title filter appears past one page. */
const SERIES_PER_PAGE = 20;

/** One of my teams: its task boards and members, and for its leaders the tools to add a series or invite a member. */
@Component({
  selector: 'app-team-panel',
  imports: [RouterLink, FormField, FieldErrors, AriaInvalidDirective, InviteMember, TeamRoster, Icon],
  templateUrl: './team-panel.html',
  styleUrl: './team-panel.scss'
})
export class TeamPanel {
  private readonly teamsApi = inject(TeamsApi);
  private readonly catalogApi = inject(CatalogApi);
  private readonly scanlationApi = inject(ScanlationApi);

  readonly team = input.required<MyTeam>();
  /** The team gained a series, a board was switched, or I left it: the list should be loaded again. */
  readonly changed = output();

  protected readonly leads = computed(() => leadsTeam(this.team()));
  protected readonly canPublish = computed(() => publishesForTeam(this.team()));
  protected readonly myRoles = computed(() => this.team().myRoles.map((role) => SCANLATION_ROLE_LABELS[role]));
  private readonly boardWorkIds = computed(() => new Set(this.team().boards.map((board) => board.work.id)));

  protected readonly seriesPerPage = SERIES_PER_PAGE;
  protected readonly filterModel = signal({ text: '' });
  protected readonly filterForm = form(this.filterModel);
  private readonly filterText = computed(() => this.filterModel().text.trim().toLocaleLowerCase());
  /** The team's series whose title contains the filter (all of them without one). */
  protected readonly matching = computed(() => {
    const text = this.filterText();
    return text ? this.team().boards.filter((board) => board.work.title.toLocaleLowerCase().includes(text)) : this.team().boards;
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.matching().length / SERIES_PER_PAGE)));
  /** The page asked for, back to the first whenever the filter changes. */
  private readonly requestedPage = linkedSignal({ source: this.filterText, computation: () => 0 });
  /** Kept in range when the list shrinks (a filter, a series gone). */
  protected readonly seriesPage = computed(() => Math.min(this.requestedPage(), this.pageCount() - 1));
  protected readonly seriesPagerLabel = computed(() => $localize`:@@scanlation.teams.pager.label:Pages of the series of ${this.team().name}:team:`);
  protected readonly shownBoards = computed(() => {
    const start = this.seriesPage() * SERIES_PER_PAGE;
    return this.matching().slice(start, start + SERIES_PER_PAGE);
  });

  protected readonly searching = asyncAction();
  protected readonly searchModel = signal({ text: '' });
  protected readonly searchForm = form(this.searchModel, (path) => {
    required(path.text, { message: $localize`:@@scanlation.teams.series.textRequired:Type the title of a series` });
  });
  /** `null` until a search ran. Series the team already has are left out. */
  protected readonly found = signal<WorkSummary[] | null>(null);
  protected readonly adding = asyncAction();
  protected readonly switching = asyncAction();

  protected showSeriesPage(page: number): void {
    this.requestedPage.set(Math.min(Math.max(page, 0), this.pageCount() - 1));
  }

  protected async search(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.searchForm, async (f) => {
      await this.searching.run(async () => {
        const works = await firstValueFrom(this.catalogApi.suggest(f().value().text.trim(), SEARCH_RESULTS));
        this.found.set(works.filter((work) => !this.boardWorkIds().has(work.id)));
      });
    });
  }

  /** A leader turns the series' task board on or off; the list is loaded again to show it. */
  protected async switchBoard(projectId: string, enabled: boolean): Promise<void> {
    await this.switching.run(async () => {
      await firstValueFrom(this.scanlationApi.setBoard(projectId, enabled));
      this.changed.emit();
    }, { key: projectId });
  }

  protected async addSeries(work: WorkSummary): Promise<void> {
    await this.adding.run(async () => {
      await firstValueFrom(this.teamsApi.addSeries(this.team().id, work.id));
      this.found.set(null);
      this.changed.emit();
    }, { key: work.id });
  }
}
