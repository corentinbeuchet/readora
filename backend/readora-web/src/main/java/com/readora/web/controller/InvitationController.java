package com.readora.web.controller;

import com.readora.application.port.in.ManageTeamUseCase;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamInvitationId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.MyTeamDto;
import com.readora.web.dto.TeamInvitationDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/// The invitations a reader answers (US-12): only the invited reader may accept or decline one.
@RestController
@RequestMapping("/api/v1/invitations")
@Tag(name = "Team invitations", description = "Joining a scanlation team by accepting its invitation (US-12)")
public class InvitationController {

    private final ManageTeamUseCase teams;
    private final CurrentUserProvider currentUserProvider;

    public InvitationController(ManageTeamUseCase teams, CurrentUserProvider currentUserProvider) {
        this.teams = teams;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/mine")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "The team invitations waiting for my answer")
    public ResponseEntity<ApiResponse<List<TeamInvitationDto>>> mine() {
        return ResponseEntity.ok(ApiResponse.ok(teams.myInvitations(currentUserProvider.requireUserId()).stream()
                .map(TeamInvitationDto::fromDomain).toList()));
    }

    @PostMapping("/{invitationId}/accept")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Accept an invitation: I join the team with the invited roles")
    public ResponseEntity<ApiResponse<MyTeamDto>> accept(@PathVariable UUID invitationId) {
        UserId me = currentUserProvider.requireUserId();
        return ResponseEntity.ok(ApiResponse.ok(MyTeamDto.fromDomain(teams.acceptInvitation(me, TeamInvitationId.of(invitationId)), me)));
    }

    @PostMapping("/{invitationId}/decline")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Decline an invitation")
    public ResponseEntity<ApiResponse<String>> decline(@PathVariable UUID invitationId) {
        teams.declineInvitation(currentUserProvider.requireUserId(), TeamInvitationId.of(invitationId));
        return ResponseEntity.ok(ApiResponse.ok("Declined"));
    }
}
