package com.readora.domain.scanlation;

import com.readora.domain.common.UserId;
import java.io.Serializable;
import java.time.Instant;
import java.util.Collections;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

public record TeamMember(UserId userId, Set<ScanlationRole> roles, Instant joinedAt) implements Serializable {
    public TeamMember(UserId userId, Set<ScanlationRole> roles, Instant joinedAt) {
        this.userId = Objects.requireNonNull(userId, "UserId cannot be null");
        this.roles = roles != null ? new HashSet<>(roles) : new HashSet<>();
        this.joinedAt = joinedAt != null ? joinedAt : Instant.now();
    }

    public static TeamMember of(UserId userId, ScanlationRole... roles) {
        return new TeamMember(userId, Set.of(roles), Instant.now());
    }

    public boolean hasRole(ScanlationRole role) {
        return this.roles.contains(role) || this.roles.contains(ScanlationRole.LEADER);
    }

    @Override
    public Set<ScanlationRole> roles() {
        return Collections.unmodifiableSet(roles);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TeamMember that = (TeamMember) o;
        return Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId);
    }
}
