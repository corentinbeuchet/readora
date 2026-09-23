import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MyTeam, ScanlationProject, ScanlationRole, TeamInvitation } from '@app/core/models/scanlation';
import { ApiClient, parseEnvelope } from './api-client';

/**
 * Running a team (US-12), `/api/v1/teams`: any signed-in reader; the server requires the caller to lead the team
 * for roster and series changes. The public team page is on `CommunityApi`.
 */
@Service()
export class TeamsApi {
  private readonly api = inject(ApiClient);

  /** The teams I belong to, with their task boards; idle until `enabled`. */
  mineResource(enabled: Signal<boolean>): HttpResourceRef<MyTeam[]> {
    return httpResource<MyTeam[]>(() => (enabled() ? this.api.url('/teams/mine') : undefined), {
      parse: (raw) => parseEnvelope<MyTeam[]>(raw) ?? [],
      defaultValue: []
    });
  }

  create(request: { name: string; description: string }): Observable<MyTeam> {
    return this.api.post<MyTeam>('/teams', request);
  }

  /** Replaces the roles of a member; newcomers are invited instead. */
  setMember(teamId: string, username: string, roles: ScanlationRole[]): Observable<MyTeam> {
    return this.api.put<MyTeam>(`/teams/${teamId}/members/${encodeURIComponent(username)}`, { roles });
  }

  /** Invites a reader into the team; they join once they accept. */
  invite(teamId: string, username: string, roles: ScanlationRole[]): Observable<TeamInvitation> {
    return this.api.post<TeamInvitation>(`/teams/${teamId}/invitations`, { username, roles });
  }

  /** The team's invitations still waiting for an answer (leaders); idle until `enabled`. */
  invitationsResource(teamId: Signal<string>, enabled: Signal<boolean>): HttpResourceRef<TeamInvitation[]> {
    return httpResource<TeamInvitation[]>(() => (enabled() ? this.api.url(`/teams/${teamId()}/invitations`) : undefined), {
      parse: (raw) => parseEnvelope<TeamInvitation[]>(raw) ?? [],
      defaultValue: []
    });
  }

  cancelInvitation(teamId: string, invitationId: string): Observable<void> {
    return this.api.delete(`/teams/${teamId}/invitations/${invitationId}`);
  }

  /** The invitations waiting for my answer; idle until `enabled`. */
  myInvitationsResource(enabled: Signal<boolean>): HttpResourceRef<TeamInvitation[]> {
    return httpResource<TeamInvitation[]>(() => (enabled() ? this.api.url('/invitations/mine') : undefined), {
      parse: (raw) => parseEnvelope<TeamInvitation[]>(raw) ?? [],
      defaultValue: []
    });
  }

  /** I join the team with the invited roles. */
  acceptInvitation(invitationId: string): Observable<MyTeam> {
    return this.api.post<MyTeam>(`/invitations/${invitationId}/accept`);
  }

  declineInvitation(invitationId: string): Observable<string> {
    return this.api.post<string>(`/invitations/${invitationId}/decline`);
  }

  /** Starts the team's own task board for an existing series. */
  addSeries(teamId: string, workId: string): Observable<ScanlationProject> {
    return this.api.post<ScanlationProject>(`/teams/${teamId}/series`, { workId });
  }
}
