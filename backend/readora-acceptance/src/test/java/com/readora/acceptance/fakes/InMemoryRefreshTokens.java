package com.readora.acceptance.fakes;

import com.readora.application.port.out.RefreshTokenRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.RefreshToken;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/// Same semantics as `RefreshTokenRepositoryAdapter`, in memory (by token hash).
public class InMemoryRefreshTokens implements RefreshTokenRepositoryPort {

    private final Map<String, RefreshToken> tokens = new ConcurrentHashMap<>();

    @Override
    public Optional<RefreshToken> findByTokenHash(String tokenHash) {
        return Optional.ofNullable(tokens.get(tokenHash));
    }

    @Override
    public RefreshToken save(RefreshToken token) {
        tokens.put(token.getTokenHash(), token);
        return token;
    }

    @Override
    public void revokeAllForUser(UserId userId) {
        tokens.values().stream().filter(token -> token.getUserId().equals(userId) && token.getRevokedAt() == null).forEach(RefreshToken::revoke);
    }

    @Override
    public void deleteAllForUser(UserId userId) {
        tokens.values().removeIf(token -> token.getUserId().equals(userId));
    }

    @Override
    public boolean revokeIfActive(String tokenHash, Instant now) {
        RefreshToken token = tokens.get(tokenHash);
        if (token == null || token.getRevokedAt() != null) {
            return false;
        }
        token.revoke();
        return true;
    }

    @Override
    public void deleteExpiredBefore(Instant threshold) {
        tokens.values().removeIf(token -> token.getExpiresAt().isBefore(threshold));
    }
}
