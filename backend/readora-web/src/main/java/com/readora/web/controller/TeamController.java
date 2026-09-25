package com.readora.web.controller;

import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.application.port.in.ManageTeamUseCase;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamInvitationId;
import com.readora.domain.work.WorkId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.CreateTeamRequest;
import com.readora.web.dto.InviteMemberRequest;
import com.readora.web.dto.MyTeamDto;
import com.readora.web.dto.PagedResponse;
import com.readora.web.dto.ScanlationProjectDto;
import com.readora.web.dto.TeamInvitationDto;
import com.readora.web.dto.TeamMemberRequest;
import com.readora.web.dto.TeamSeriesRequest;
import com.readora.web.dto.WaitingTaskDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/// Running a team (US-12). Any signed-in reader may start a team; what they may do in it comes from their roles in
/// that team, which the use case checks (leaders manage the roster and the series).
@RestController
@RequestMapping("/api/v1/teams")
@Tag(name = "Teams", description = "Creating a scanlation team, its roster and its series (US-12)")
public class TeamController {

    private final ManageTeamUseCase teams;
    private final BrowseCatalogUseCase catalog;
    private final CurrentUserProvider currentUserProvider;

    public TeamController(ManageTeamUseCase teams, BrowseCatalogUseCase catalog, CurrentUserProvider currentUserProvider) {
        this.teams = teams;
        this.catalog = catalog;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/mine")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "The teams I belong to, with their task boards")
    public ResponseEntity<ApiResponse<List<MyTeamDto>>> mine() {
        UserId me = currentUserProvider.requireUserId();
        return ResponseEntity.ok(ApiResponse.ok(teams.myTeams(me).stream().map(team -> MyTeamDto.fromDomain(team, me)).toList()));
    }

    @GetMapping("/mine/tasks")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "What waits for me across my teams' task boards, a page at a time: tasks I hold, then open ones my roles cover")
    public ResponseEntity<ApiResponse<PagedResponse<WaitingTaskDto>>> waitingForMe(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.ok(PagedResponse.from(
                teams.waitingFor(currentUserProvider.requireUserId(), page, size), WaitingTaskDto::fromDomain)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Create a team; I become its leader")
    public ResponseEntity<ApiResponse<MyTeamDto>> create(@Valid @RequestBody CreateTeamRequest request) {
        UserId me = currentUserProvider.requireUserId();
        var team = teams.createTeam(me, request.name(), request.description());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(MyTeamDto.fromDomain(team, me)));
    }

    @PutMapping("/{teamId}/members/{username}")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Change the roles of a member of my team (team leaders); newcomers are invited")
    public ResponseEntity<ApiResponse<MyTeamDto>> setMember(@PathVariable UUID teamId, @PathVariable String username,
                                                            @Valid @RequestBody TeamMemberRequest request) {
        UserId me = currentUserProvider.requireUserId();
        return ResponseEntity.ok(ApiResponse.ok(MyTeamDto.fromDomain(teams.setMember(me, TeamId.of(teamId), username, request.roles()), me)));
    }

    @PostMapping("/{teamId}/invitations")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Invite a reader to my team with some roles (team leaders); they join once they accept")
    public ResponseEntity<ApiResponse<TeamInvitationDto>> invite(@PathVariable UUID teamId, @Valid @RequestBody InviteMemberRequest request) {
        var invitation = teams.invite(currentUserProvider.requireUserId(), TeamId.of(teamId), request.username().trim(), request.roles());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(TeamInvitationDto.fromDomain(invitation)));
    }

    @GetMapping("/{teamId}/invitations")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "My team's invitations waiting for an answer (team leaders)")
    public ResponseEntity<ApiResponse<List<TeamInvitationDto>>> pendingInvitations(@PathVariable UUID teamId) {
        return ResponseEntity.ok(ApiResponse.ok(teams.pendingInvitations(currentUserProvider.requireUserId(), TeamId.of(teamId)).stream()
                .map(TeamInvitationDto::fromDomain).toList()));
    }

    @DeleteMapping("/{teamId}/invitations/{invitationId}")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Withdraw an invitation of my team (team leaders)")
    public ResponseEntity<Void> cancelInvitation(@PathVariable UUID teamId, @PathVariable UUID invitationId) {
        teams.cancelInvitation(currentUserProvider.requireUserId(), TeamInvitationId.of(invitationId));
        return ResponseEntity.noContent().build();
    }

    /// `LIBRARY_USE` is what every signed-in account has: any member must be able to leave.
    @DeleteMapping("/{teamId}/members/{username}")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Remove a member from my team (team leaders), or leave it")
    public ResponseEntity<ApiResponse<MyTeamDto>> removeMember(@PathVariable UUID teamId, @PathVariable String username) {
        UserId me = currentUserProvider.requireUserId();
        return ResponseEntity.ok(ApiResponse.ok(MyTeamDto.fromDomain(teams.removeMember(me, TeamId.of(teamId), username), me)));
    }

    @PostMapping("/{teamId}/series")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Start my team's task board for an existing series (team leaders)")
    public ResponseEntity<ApiResponse<ScanlationProjectDto>> addSeries(@PathVariable UUID teamId, @Valid @RequestBody TeamSeriesRequest request) {
        UserId me = currentUserProvider.requireUserId();
        ScanlationProject project = teams.addSeries(me, TeamId.of(teamId), WorkId.of(request.workId()));
        return catalog.getProject(project.getId(), me)
                .map(board -> ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(ScanlationProjectDto.fromDomain(board))))
                .orElseThrow();
    }
}
