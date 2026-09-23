package com.readora.web.dto;

import com.readora.application.port.in.ManageTeamUseCase.InvitationView;
import com.readora.domain.scanlation.TeamInvitation;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/// An invitation to join a team, with the names a screen shows.
public record TeamInvitationDto(UUID id, UUID teamId, String teamName, String invitee, List<String> roles, String invitedBy,
                                String status, Instant createdAt) {

    public static TeamInvitationDto fromDomain(InvitationView view) {
        TeamInvitation invitation = view.invitation();
        return new TeamInvitationDto(invitation.getId().value(), invitation.getTeamId().value(), view.teamName(), view.inviteeUsername(),
                invitation.getRoles().stream().map(Enum::name).sorted().toList(), view.invitedByUsername(), invitation.getStatus().name(),
                invitation.getCreatedAt());
    }
}
