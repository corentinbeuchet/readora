import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { catchError, distinctUntilChanged, firstValueFrom, of, switchMap, timer } from 'rxjs';
import { CommunityApi } from '@app/core/api/community-api';
import { TeamsApi } from '@app/core/api/teams-api';
import { ReaderRef } from '@app/core/models/community';
import { MyTeam, SCANLATION_ROLES, SCANLATION_ROLE_LABELS, ScanlationRole, TeamInvitation } from '@app/core/models/scanlation';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { LoadError } from '@app/shared/ui/load-error';

/** Suggestions wait for a pause in typing, and at least two characters (the server's minimum). */
export const READER_SEARCH_DEBOUNCE_MS = 300;
const READER_SEARCH_MIN = 2;

/**
 * A leader invites a reader into the team (US-12): the username field suggests readers by the start of their name
 * (a native `datalist`, so the field stays a plain text box for keyboards and screen readers), and the invitations
 * still waiting for an answer can be cancelled.
 */
@Component({
  selector: 'app-invite-member',
  imports: [FormField, FieldErrors, AriaInvalidDirective, LoadError],
  templateUrl: './invite-member.html',
  styleUrl: './invite-member.scss'
})
export class InviteMember {
  private readonly teamsApi = inject(TeamsApi);
  private readonly communityApi = inject(CommunityApi);

  readonly team = input.required<MyTeam>();

  protected readonly roles = SCANLATION_ROLES.map((role) => ({ role, label: SCANLATION_ROLE_LABELS[role] }));
  protected readonly roleLabels = SCANLATION_ROLE_LABELS;
  private readonly teamId = computed(() => this.team().id);
  private readonly always = signal(true).asReadonly();
  protected readonly invitations = this.teamsApi.invitationsResource(this.teamId, this.always);
  protected readonly cancelling = asyncAction();

  protected readonly saving = asyncAction();
  protected readonly invited = signal<string | null>(null);
  private readonly model = signal<{ username: string; role: ScanlationRole }>({ username: '', role: 'TRANSLATOR' });
  protected readonly memberForm = form(this.model, (path) => {
    required(path.username, { message: $localize`:@@scanlation.teams.member.usernameRequired:Type their username` });
  });

  /**
   * Readers whose username starts with what is typed. The pause is a timer per text inside `switchMap` (like the
   * upload studio's similar titles), so a stale answer never replaces a newer one.
   */
  protected readonly suggestions = toSignal(
    toObservable(computed(() => this.model().username.trim())).pipe(
      distinctUntilChanged(),
      switchMap((text) =>
        text.length < READER_SEARCH_MIN
          ? of<ReaderRef[]>([])
          : timer(READER_SEARCH_DEBOUNCE_MS).pipe(
              switchMap(() => this.communityApi.findReaders(text)),
              catchError(() => of<ReaderRef[]>([]))
            )
      )
    ),
    { initialValue: [] }
  );

  /** Sends the invitation; the reader joins once they accept it. */
  protected async invite(event: Event): Promise<void> {
    event.preventDefault();
    this.invited.set(null);
    await submit(this.memberForm, async (f) => {
      const { username, role } = f().value();
      await this.saving.run(async () => {
        const invitation = await firstValueFrom(this.teamsApi.invite(this.team().id, username.trim(), [role]));
        this.invitations.update((pending) => [...pending, invitation]);
        this.invited.set(invitation.invitee);
        this.model.set({ username: '', role });
        f().reset();
      });
    });
  }

  protected async cancel(invitation: TeamInvitation): Promise<void> {
    await this.cancelling.run(async () => {
      await firstValueFrom(this.teamsApi.cancelInvitation(this.team().id, invitation.id));
      this.invitations.update((pending) => pending.filter((i) => i.id !== invitation.id));
    }, { key: invitation.id });
  }
}
