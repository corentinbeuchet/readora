import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedResponse } from '@app/core/models/api';
import { MyTeam, ScanlationProject, ScanlationRole, TeamInvitation, WaitingTask } from '@app/core/models/scanlation';
import { ApiClient, parseEnvelope } from './api-client';

const NOTHING_WAITS: PagedResponse<WaitingTask> = { items: [], page: 0, size: 0, totalElements: 0, totalPages: 0 };

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

  /** What waits for me across my teams' boards, 20 per page: the tasks I hold first, then open ones my roles cover. */
  waitingResource(enabled: Signal<boolean>, page: Signal<number>): HttpResourceRef<PagedResponse<WaitingTask>> {
    return httpResource<PagedResponse<WaitingTask>>(
      () => (enabled() ? { url: this.api.url('/teams/mine/tasks'), params: { page: page() } } : undefined),
      { parse: (raw) => parseEnvelope<PagedResponse<WaitingTask>>(raw) ?? NOTHING_WAITS, defaultValue: NOTHING_WAITS }
    );
  }

  create(request: { name: string; description: string }): Observable<MyTeam> {
    return this.api.post<MyTeam>('/teams', request);
  }

  /** Replaces the roles of a member; newcomers are invited instead. */
  setMember(teamId: string, username: string, roles: ScanlationRole[]): Observable<MyTeam> {
    return this.api.put<MyTeam>(`/teams/${teamId}/members/${encodeURIComponent(username)}`, { roles });
  }

  /** A leader removes a member; a member removes themselves to leave the team. */
  removeMember(teamId: string, username: string): Observable<MyTeam> {
    return this.api.delete<MyTeam>(`/teams/${teamId}/members/${encodeURIComponent(username)}`);
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
