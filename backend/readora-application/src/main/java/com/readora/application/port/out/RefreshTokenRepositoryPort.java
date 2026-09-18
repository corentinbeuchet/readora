package com.readora.application.port.out;

import com.readora.domain.identity.RefreshToken;
import com.readora.domain.common.UserId;

import java.util.Optional;

public interface RefreshTokenRepositoryPort {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    RefreshToken save(RefreshToken token);
    void revokeAllForUser(UserId userId);

    /// Atomically revokes the token if it is still active. Returns `false` if someone else revoked it first
    /// (concurrent refresh), so only one caller can rotate a given token.
    boolean revokeIfActive(String tokenHash, java.time.Instant now);
    void deleteExpiredBefore(java.time.Instant threshold);
}
