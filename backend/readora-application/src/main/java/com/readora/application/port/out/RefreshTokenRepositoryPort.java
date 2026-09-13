package com.readora.application.port.out;

import com.readora.domain.identity.RefreshToken;
import com.readora.domain.work.UserId;

import java.util.Optional;

public interface RefreshTokenRepositoryPort {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    RefreshToken save(RefreshToken token);
    void revokeAllForUser(UserId userId);
    void deleteExpiredBefore(java.time.Instant threshold);
}
