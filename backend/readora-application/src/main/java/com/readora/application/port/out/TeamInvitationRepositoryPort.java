package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamInvitation;
import com.readora.domain.scanlation.TeamInvitationId;

import java.util.List;
import java.util.Optional;

public interface TeamInvitationRepositoryPort {
    TeamInvitation save(TeamInvitation invitation);

    Optional<TeamInvitation> findById(TeamInvitationId id);

    /// The team's pending invitations, oldest first.
    List<TeamInvitation> findPendingByTeam(TeamId teamId);

    /// The reader's pending invitations, newest first.
    List<TeamInvitation> findPendingByInvitee(UserId inviteeId);

    /// The reader's pending invitation to this team, if any (a reader is not invited twice at once).
    Optional<TeamInvitation> findPending(TeamId teamId, UserId inviteeId);
}
