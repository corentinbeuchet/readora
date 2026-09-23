import { Component, DOCUMENT, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommunityApi } from '@app/core/api/community-api';
import { TeamsApi } from '@app/core/api/teams-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { MyTeam, SCANLATION_ROLES, SCANLATION_ROLE_LABELS, ScanlationRole, leadsTeam } from '@app/core/models/scanlation';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';

/**
 * Who is on the team and with which roles (US-12). Leaders change the roles of a member or remove them; every
 * member can leave (the server keeps at least one leader: `LAST_LEADER`).
 */
@Component({
  selector: 'app-team-roster',
  imports: [LoadError],
  templateUrl: './team-roster.html',
  styleUrl: './team-roster.scss'
})
export class TeamRoster {
  private readonly communityApi = inject(CommunityApi);
  private readonly teamsApi = inject(TeamsApi);
  private readonly auth = inject(AuthStore);
  private readonly document = inject(DOCUMENT);

  readonly team = input.required<MyTeam>();
  /** I left the team: it is no longer mine. */
  readonly left = output();

  /** Where focus goes once a removed member's row (and its button) is gone. */
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  protected readonly roleLabels = SCANLATION_ROLE_LABELS;
  protected readonly leads = computed(() => leadsTeam(this.team()));
  private readonly teamId = computed(() => this.team().id);
  protected readonly roster = this.communityApi.teamResource(this.teamId);
  private readonly me = computed(() => this.auth.user()?.username ?? null);
  /** One row per member, mine first, with what I may do on it. */
  protected readonly rows = computed(() => {
    const members = this.roster.hasValue() ? (this.roster.value()?.members ?? []) : [];
    const me = this.me();
    return [...members]
      .sort((a, b) => Number(b.username === me) - Number(a.username === me))
      .map((member) => ({ ...member, isMe: member.username === me, roleNames: member.roles.map((role) => SCANLATION_ROLE_LABELS[role]) }));
  });

  /** The member whose roles are being edited, with the roles ticked so far. */
  protected readonly editing = signal<{ username: string; roles: ScanlationRole[] } | null>(null);
  protected readonly allRoles = SCANLATION_ROLES;
  protected readonly changing = asyncAction();

  protected editRoles(username: string, roles: ScanlationRole[]): void {
    this.changing.clearError();
    this.editing.set({ username, roles: [...roles] });
  }

  protected cancelEdit(): void {
    this.editing.set(null);
  }

  protected toggleRole(role: ScanlationRole, checked: boolean): void {
    this.editing.update((edit) =>
      edit ? { ...edit, roles: checked ? [...edit.roles, role] : edit.roles.filter((r) => r !== role) } : edit
    );
  }

  protected async saveRoles(): Promise<void> {
    const edit = this.editing();
    if (!edit) {
      return;
    }
    await this.changing.run(async () => {
      await firstValueFrom(this.teamsApi.setMember(this.team().id, edit.username, edit.roles));
      this.editing.set(null);
      this.roster.reload();
    }, { key: edit.username });
  }

  protected async remove(username: string): Promise<void> {
    await this.changing.run(async () => {
      await firstValueFrom(this.teamsApi.removeMember(this.team().id, username));
      this.roster.reload();
      this.heading().nativeElement.focus();
    }, { key: username });
  }

  protected async leave(): Promise<void> {
    const me = this.me();
    if (!me) {
      return;
    }
    await this.changing.run(async () => {
      await firstValueFrom(this.teamsApi.removeMember(this.team().id, me));
      this.focusThePage();
      this.left.emit();
    }, { key: me });
  }

  /** After leaving, this whole panel goes away: the page heading takes the focus (as after a navigation). */
  private focusThePage(): void {
    const heading = this.document.querySelector<HTMLElement>('main h1');
    if (heading && !heading.hasAttribute('tabindex')) {
      heading.setAttribute('tabindex', '-1');
    }
    heading?.focus({ preventScroll: true });
  }
}
