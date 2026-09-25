import { Component, ElementRef, Injector, afterNextRender, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TeamsApi } from '@app/core/api/teams-api';
import { SCANLATION_ROLE_LABELS, TeamInvitation, WORKFLOW_STAGE_LABELS } from '@app/core/models/scanlation';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { EmptyState } from '@app/shared/ui/empty-state/empty-state';
import { Icon } from '@app/shared/ui/icon/icon';
import { LoadError } from '@app/shared/ui/load-error';
import { TeamPanel } from './team-panel/team-panel';

/** The Studio (US-12): my invitations, what waits for me, the teams I belong to with their boards, and a new-team form. */
@Component({
  selector: 'app-my-teams-page',
  imports: [RouterLink, LoadError, EmptyState, FieldErrors, AriaInvalidDirective, FormField, HasPermissionDirective, TeamPanel, Icon],
  templateUrl: './my-teams-page.html',
  styleUrl: './my-teams-page.scss'
})
export class MyTeamsPage {
  private readonly api = inject(TeamsApi);
  private readonly auth = inject(AuthStore);
  private readonly injector = inject(Injector);
  private readonly newTeamToggle = viewChild<ElementRef<HTMLButtonElement>>('newTeamToggle');
  private readonly newTeamName = viewChild<ElementRef<HTMLInputElement>>('newTeamName');

  private readonly canView = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly teams = this.api.mineResource(this.canView);
  /** Invitations waiting for my answer; I join a team by accepting one. */
  protected readonly invitations = this.api.myInvitationsResource(this.canView);
  protected readonly answering = asyncAction();
  protected readonly roleLabels = SCANLATION_ROLE_LABELS;
  protected readonly hasTeams = computed(() => this.teams.hasValue() && this.teams.value().length > 0);
  /** The page of "Waiting for you" shown, from 0. */
  protected readonly waitingPage = signal(0);
  /** What I can take on next across my teams' boards, and what I hold (listed first by the server); only with a team. */
  protected readonly waiting = this.api.waitingResource(computed(() => this.canView() && this.hasTeams()), this.waitingPage);
  /** Kept while the next page loads (the resource is empty meanwhile), so the pager and its focused button stay put. */
  protected readonly waitingPages = linkedSignal<number, number>({
    source: () => (this.waiting.status() === 'resolved' ? this.waiting.value().totalPages : -1),
    computation: (total, previous) => (total >= 0 ? total : (previous?.value ?? 0))
  });
  protected readonly stageLabels = WORKFLOW_STAGE_LABELS;
  /** Starting a team is rare once I have one: the form opens from the header, and is open while I am on no team. */
  protected readonly newTeamOpen = linkedSignal(() => this.canView() && this.teams.status() === 'resolved' && this.teams.value().length === 0);
  protected readonly creating = asyncAction();
  protected readonly model = signal({ name: '', description: '' });
  protected readonly newTeamForm = form(this.model, (path) => {
    required(path.name, { message: $localize`:@@scanlation.teams.new.nameRequired:Give your team a name` });
    maxLength(path.name, 255);
    maxLength(path.description, 1000);
  });

  constructor() {
    inject(SeoService).private_($localize`:@@scanlation.teams.seoTitle:Studio`);
  }

  /** I join the team: it appears in my list, and the invitation goes away. */
  protected async accept(invitation: TeamInvitation): Promise<void> {
    await this.answering.run(async () => {
      await firstValueFrom(this.api.acceptInvitation(invitation.id));
      this.invitations.update((pending) => pending.filter((i) => i.id !== invitation.id));
      this.teams.reload();
      this.waitingPage.set(0);
      this.waiting.reload();
    }, { key: invitation.id });
  }

  protected showWaitingPage(page: number): void {
    this.waitingPage.set(Math.min(Math.max(page, 0), Math.max(this.waitingPages() - 1, 0)));
  }

  protected async decline(invitation: TeamInvitation): Promise<void> {
    await this.answering.run(async () => {
      await firstValueFrom(this.api.declineInvitation(invitation.id));
      this.invitations.update((pending) => pending.filter((i) => i.id !== invitation.id));
    }, { key: invitation.id });
  }

  protected toggleNewTeam(): void {
    if (this.newTeamOpen()) {
      this.closeNewTeam();
      return;
    }
    this.newTeamOpen.set(true);
    afterNextRender(() => this.newTeamName()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Closes the form; focus goes back to the button that opens it (the form and its buttons are gone). */
  protected closeNewTeam(): void {
    this.newTeamOpen.set(false);
    this.creating.clearError();
    afterNextRender(() => this.newTeamToggle()?.nativeElement.focus(), { injector: this.injector });
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
        this.closeNewTeam();
      });
    });
  }
}
