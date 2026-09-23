package com.readora.domain.scanlation;

import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.UserId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

/// A leader's invitation for a reader to join a team with some roles (US-12). Nobody lands in a team without
/// agreeing: the reader accepts (and joins) or declines; the leader may cancel it while it is pending.
public class TeamInvitation extends AggregateRoot<TeamInvitationId> {
    private final TeamId teamId;
    private final UserId inviteeId;
    private final Set<ScanlationRole> roles;
    private final UserId invitedBy;
    private InvitationStatus status;
    private final Instant createdAt;
    private @Nullable Instant answeredAt;

    public TeamInvitation(TeamInvitationId id, TeamId teamId, UserId inviteeId, Set<ScanlationRole> roles, UserId invitedBy,
                          InvitationStatus status, Instant createdAt, @Nullable Instant answeredAt) {
        super(id);
        this.teamId = Objects.requireNonNull(teamId, "TeamId cannot be null");
        this.inviteeId = Objects.requireNonNull(inviteeId, "Invitee cannot be null");
        if (roles == null || roles.isEmpty()) {
            throw new DomainValidationException("An invitation needs at least one role");
        }
        this.roles = Set.copyOf(EnumSet.copyOf(roles));
        this.invitedBy = Objects.requireNonNull(invitedBy, "Inviter cannot be null");
        this.status = Objects.requireNonNull(status, "InvitationStatus cannot be null");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt cannot be null");
        this.answeredAt = answeredAt;
    }

    /// Invites `inviteeId` into `team`; the service checks that `invitedBy` may (a leader, or an admin).
    ///
    /// @throws DomainValidationException `ALREADY_ON_TEAM` if the reader is already a member
    public static TeamInvitation create(Team team, UserId inviteeId, Set<ScanlationRole> roles, UserId invitedBy, Instant now) {
        if (team.findMember(inviteeId).isPresent()) {
            throw DomainValidationException.withCode(ErrorCodes.ALREADY_ON_TEAM, inviteeId + " is already on " + team.getName());
        }
        TeamInvitation invitation = new TeamInvitation(TeamInvitationId.generate(), team.getId(), inviteeId, roles, invitedBy,
                InvitationStatus.PENDING, now, null);
        invitation.registerEvent(TeamInvitedEvent.now(invitation.getId()));
        return invitation;
    }

    /// The invitee joins `team` with the invited roles.
    ///
    /// @throws AccessDeniedDomainException if `actor` is not the invitee
    /// @throws DomainValidationException `ALREADY_HANDLED` if the invitation was already answered or cancelled
    public void accept(Team team, UserId actor, Instant now) {
        requireInvitee(actor);
        requirePending();
        if (!team.getId().equals(teamId)) {
            throw new DomainValidationException("This invitation is for another team");
        }
        team.addMember(new TeamMember(inviteeId, roles, now));
        close(InvitationStatus.ACCEPTED, now);
    }

    /// @throws AccessDeniedDomainException if `actor` is not the invitee
    /// @throws DomainValidationException `ALREADY_HANDLED` if the invitation was already answered or cancelled
    public void decline(UserId actor, Instant now) {
        requireInvitee(actor);
        requirePending();
        close(InvitationStatus.DECLINED, now);
    }

    /// Withdraws a pending invitation; the service checks that the actor leads the team.
    ///
    /// @throws DomainValidationException `ALREADY_HANDLED` if the invitation was already answered or cancelled
    public void cancel(Instant now) {
        requirePending();
        close(InvitationStatus.CANCELLED, now);
    }

    public boolean isPending() {
        return status == InvitationStatus.PENDING;
    }

    private void requireInvitee(UserId actor) {
        if (!inviteeId.equals(actor)) {
            throw new AccessDeniedDomainException("Only the invited reader can answer this invitation");
        }
    }

    private void requirePending() {
        if (!isPending()) {
            throw DomainValidationException.withCode(ErrorCodes.ALREADY_HANDLED, "This invitation was already " + status.name().toLowerCase());
        }
    }

    private void close(InvitationStatus closedAs, Instant now) {
        this.status = closedAs;
        this.answeredAt = now;
    }

    public TeamId getTeamId() {
        return teamId;
    }

    public UserId getInviteeId() {
        return inviteeId;
    }

    public Set<ScanlationRole> getRoles() {
        return roles;
    }

    public UserId getInvitedBy() {
        return invitedBy;
    }

    public InvitationStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public @Nullable Instant getAnsweredAt() {
        return answeredAt;
    }
}
