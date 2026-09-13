package com.readora.domain.identity;

import com.readora.domain.work.UserId;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class RefreshToken implements Serializable {
    private final UUID id;
    private final UserId userId;
    private final String tokenHash;
    private final Instant expiresAt;
    private Instant revokedAt;
    private final Instant createdAt;

    public RefreshToken(UUID id, UserId userId, String tokenHash, Instant expiresAt, Instant revokedAt, Instant createdAt) {
        this.id = Objects.requireNonNull(id, "RefreshToken id cannot be null");
        this.userId = Objects.requireNonNull(userId, "UserId cannot be null");
        this.tokenHash = Objects.requireNonNull(tokenHash, "Token hash cannot be null");
        this.expiresAt = Objects.requireNonNull(expiresAt, "Expiration cannot be null");
        this.revokedAt = revokedAt;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
    }

    public static RefreshToken issue(UserId userId, String tokenHash, Instant expiresAt) {
        return new RefreshToken(UUID.randomUUID(), userId, tokenHash, expiresAt, null, Instant.now());
    }

    public boolean isValid(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public void revoke() {
        if (this.revokedAt == null) {
            this.revokedAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UserId getUserId() {
        return userId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
