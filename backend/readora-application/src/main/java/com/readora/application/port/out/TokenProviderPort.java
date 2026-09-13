package com.readora.application.port.out;

import com.readora.domain.identity.UserAccount;

import java.time.Duration;
import java.time.Instant;

public interface TokenProviderPort {

    record AccessToken(String value, Instant expiresAt) {
        public long expiresInSeconds() {
            return Math.max(0, Duration.between(Instant.now(), expiresAt).getSeconds());
        }
    }

    AccessToken issueAccessToken(UserAccount account);

    String generateRefreshToken();

    String hashRefreshToken(String rawRefreshToken);

    Duration refreshTokenTtl();
}
