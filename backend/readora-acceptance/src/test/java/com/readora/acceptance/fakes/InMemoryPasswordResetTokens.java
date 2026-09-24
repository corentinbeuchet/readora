package com.readora.acceptance.fakes;

import com.readora.application.port.out.PasswordResetTokenRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.PasswordResetToken;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/// Same semantics as `PasswordResetTokenRepositoryAdapter`, in memory (by token hash).
public class InMemoryPasswordResetTokens implements PasswordResetTokenRepositoryPort {

    private final Map<String, PasswordResetToken> tokens = new ConcurrentHashMap<>();

    @Override
    public PasswordResetToken save(PasswordResetToken token) {
        tokens.put(token.getTokenHash(), token);
        return new PasswordResetToken(token.getId(), token.getUserId(), token.getTokenHash(), token.getExpiresAt(), token.getUsedAt(),
                token.getCreatedAt());
    }

    @Override
    public Optional<PasswordResetToken> findByTokenHash(String tokenHash) {
        return Optional.ofNullable(tokens.get(tokenHash)).map(token -> new PasswordResetToken(token.getId(), token.getUserId(),
                token.getTokenHash(), token.getExpiresAt(), token.getUsedAt(), token.getCreatedAt()));
    }

    @Override
    public void deleteAllForUser(UserId userId) {
        tokens.values().removeIf(token -> token.getUserId().equals(userId));
    }
}
