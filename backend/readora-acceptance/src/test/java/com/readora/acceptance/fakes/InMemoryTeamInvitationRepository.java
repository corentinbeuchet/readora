package com.readora.acceptance.fakes;

import com.readora.application.port.out.TeamInvitationRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamInvitation;
import com.readora.domain.scanlation.TeamInvitationId;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/// Keeps copies, like the JPA adapter: `save` returns a new instance without pending events.
public class InMemoryTeamInvitationRepository implements TeamInvitationRepositoryPort {

    private final Map<TeamInvitationId, TeamInvitation> invitations = new ConcurrentHashMap<>();

    @Override
    public TeamInvitation save(TeamInvitation invitation) {
        invitations.put(invitation.getId(), copy(invitation));
        return copy(invitation);
    }

    @Override
    public Optional<TeamInvitation> findById(TeamInvitationId id) {
        return Optional.ofNullable(invitations.get(id)).map(InMemoryTeamInvitationRepository::copy);
    }

    @Override
    public List<TeamInvitation> findPendingByTeam(TeamId teamId) {
        return invitations.values().stream()
                .filter(i -> i.isPending() && i.getTeamId().equals(teamId))
                .sorted(Comparator.comparing(TeamInvitation::getCreatedAt))
                .map(InMemoryTeamInvitationRepository::copy)
                .toList();
    }

    @Override
    public List<TeamInvitation> findPendingByInvitee(UserId inviteeId) {
        return invitations.values().stream()
                .filter(i -> i.isPending() && i.getInviteeId().equals(inviteeId))
                .sorted(Comparator.comparing(TeamInvitation::getCreatedAt).reversed())
                .map(InMemoryTeamInvitationRepository::copy)
                .toList();
    }

    @Override
    public Optional<TeamInvitation> findPending(TeamId teamId, UserId inviteeId) {
        return invitations.values().stream()
                .filter(i -> i.isPending() && i.getTeamId().equals(teamId) && i.getInviteeId().equals(inviteeId))
                .findFirst()
                .map(InMemoryTeamInvitationRepository::copy);
    }

    private static TeamInvitation copy(TeamInvitation source) {
        return new TeamInvitation(source.getId(), source.getTeamId(), source.getInviteeId(), source.getRoles(), source.getInvitedBy(),
                source.getStatus(), source.getCreatedAt(), source.getAnsweredAt());
    }
}
