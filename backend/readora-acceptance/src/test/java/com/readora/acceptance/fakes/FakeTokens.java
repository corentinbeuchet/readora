package com.readora.acceptance.fakes;

import com.readora.application.port.out.PasswordHasherPort;
import com.readora.application.port.out.TokenProviderPort;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.UserAccount;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/// Readable stand-ins for the password hasher and the JWT provider: `hashed:<password>`, random refresh tokens.
public final class FakeTokens implements TokenProviderPort, PasswordHasherPort {

    @Override
    public AccessToken issueAccessToken(UserAccount account) {
        return new AccessToken("access-" + account.getUsername() + "-" + UUID.randomUUID(), Instant.now().plusSeconds(900));
    }

    @Override
    public String generateRefreshToken() {
        return UUID.randomUUID().toString();
    }

    @Override
    public String hashRefreshToken(String rawRefreshToken) {
        return "h:" + rawRefreshToken;
    }

    @Override
    public Duration refreshTokenTtl() {
        return Duration.ofDays(7);
    }

    @Override
    public PasswordHash hash(String rawPassword) {
        return PasswordHash.of("hashed:" + rawPassword);
    }

    @Override
    public boolean matches(String rawPassword, PasswordHash hash) {
        return hash.equals(hash(rawPassword));
    }
}
