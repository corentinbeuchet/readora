package com.readora.domain.identity;

import com.readora.domain.common.UserId;
import org.jspecify.annotations.Nullable;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/// The proof, sent by email, that the owner of an account's address asked to choose a new password (US-15). Only its
/// hash is stored; it works once, until `expiresAt`.
public final class PasswordResetToken {
    /// How long a link keeps working.
    public static final Duration LIFETIME = Duration.ofMinutes(30);

    private final UUID id;
    private final UserId userId;
    private final String tokenHash;
    private final Instant expiresAt;
    private @Nullable Instant usedAt;
    private final Instant createdAt;

    public PasswordResetToken(UUID id, UserId userId, String tokenHash, Instant expiresAt, @Nullable Instant usedAt, Instant createdAt) {
        this.id = Objects.requireNonNull(id, "id cannot be null");
        this.userId = Objects.requireNonNull(userId, "UserId cannot be null");
        this.tokenHash = Objects.requireNonNull(tokenHash, "tokenHash cannot be null");
        this.expiresAt = Objects.requireNonNull(expiresAt, "expiresAt cannot be null");
        this.usedAt = usedAt;
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt cannot be null");
    }

    public static PasswordResetToken issue(UserId userId, String tokenHash, Instant now) {
        return new PasswordResetToken(UUID.randomUUID(), userId, tokenHash, now.plus(LIFETIME), null, now);
    }

    /// Not used yet and not expired.
    public boolean isUsable(Instant now) {
        return usedAt == null && now.isBefore(expiresAt);
    }

    public void use(Instant now) {
        this.usedAt = now;
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

    public @Nullable Instant getUsedAt() {
        return usedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
