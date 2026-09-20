package com.readora.domain.scanlation;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Collections;
import java.util.HashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/// A scanlation team: one roster whose roles apply to every series the team works on. Each of those series has its
/// own [ScanlationProject] (the task board), which points back here through its `teamId`.
public class Team extends AggregateRoot<TeamId> {
    public static final int MAX_NAME_LENGTH = 255;
    public static final int MAX_DESCRIPTION_LENGTH = 1000;

    private final String name;
    private final @Nullable String description;
    private final Set<TeamMember> members = new HashSet<>();
    private final Instant createdAt;
    private Instant updatedAt;

    public Team(TeamId id, String name, @Nullable String description, @Nullable Set<TeamMember> members,
                @Nullable Instant createdAt, @Nullable Instant updatedAt) {
        super(id);
        this.name = validateName(name);
        this.description = normaliseDescription(description);
        if (members != null) {
            this.members.addAll(members);
        }
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static Team create(String name, @Nullable String description, UserId leaderId) {
        Instant now = Instant.now();
        Team team = new Team(TeamId.generate(), name, description, Set.of(), now, now);
        team.addMember(TeamMember.of(leaderId, ScanlationRole.LEADER));
        return team;
    }

    private static String validateName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new DomainValidationException("Team name cannot be empty");
        }
        String trimmed = name.trim();
        if (trimmed.length() > MAX_NAME_LENGTH) {
            throw new DomainValidationException("Team name cannot exceed " + MAX_NAME_LENGTH + " characters");
        }
        return trimmed;
    }

    private static @Nullable String normaliseDescription(@Nullable String description) {
        if (description == null || description.trim().isEmpty()) {
            return null;
        }
        String trimmed = description.trim();
        if (trimmed.length() > MAX_DESCRIPTION_LENGTH) {
            throw new DomainValidationException("Team description cannot exceed " + MAX_DESCRIPTION_LENGTH + " characters");
        }
        return trimmed;
    }

    /// Adds a member, or replaces the roles of an existing one.
    ///
    /// @throws DomainValidationException if the member has no role, or with the code `LAST_LEADER` if the change
    ///         would leave the team without a leader
    public void addMember(TeamMember member) {
        Objects.requireNonNull(member, "TeamMember cannot be null");
        if (member.roles().isEmpty()) {
            throw new DomainValidationException("A team member needs at least one role");
        }
        if (!member.roles().contains(ScanlationRole.LEADER)) {
            requireAnotherLeader(member.userId());
        }
        this.members.remove(member);
        this.members.add(member);
        this.updatedAt = Instant.now();
    }

    /// @throws NotFoundException if the user is not on the team
    /// @throws DomainValidationException `LAST_LEADER` if the team would be left without a leader
    public void removeMember(UserId userId) {
        TeamMember member = findMember(userId).orElseThrow(() -> new NotFoundException("Team member", userId));
        requireAnotherLeader(userId);
        this.members.remove(member);
        this.updatedAt = Instant.now();
    }

    public boolean isLeader(UserId userId) {
        return findMember(userId).filter(member -> member.roles().contains(ScanlationRole.LEADER)).isPresent();
    }

    /// Guards a change that takes the leader role away from `userId` (a no-op for someone who is not a leader).
    private void requireAnotherLeader(UserId userId) {
        boolean leadsToday = isLeader(userId);
        boolean someoneElseLeads = members.stream().anyMatch(m -> !m.userId().equals(userId) && m.roles().contains(ScanlationRole.LEADER));
        if (leadsToday && !someoneElseLeads) {
            throw DomainValidationException.withCode(ErrorCodes.LAST_LEADER, "Team " + name + " must keep at least one leader");
        }
    }

    public Optional<TeamMember> findMember(UserId userId) {
        return this.members.stream().filter(m -> m.userId().equals(userId)).findFirst();
    }

    public String getName() {
        return name;
    }

    public @Nullable String getDescription() {
        return description;
    }

    public Set<TeamMember> getMembers() {
        return Collections.unmodifiableSet(members);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
