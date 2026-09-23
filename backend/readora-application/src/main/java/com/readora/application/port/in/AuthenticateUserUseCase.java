package com.readora.application.port.in;

import com.readora.domain.identity.UserAccount;
import com.readora.domain.common.UserId;

import java.time.Duration;
import java.time.Instant;

public interface AuthenticateUserUseCase {

    record AuthResult(UserAccount account, String accessToken, Instant accessTokenExpiresAt, String refreshToken, Duration refreshTokenTtl) {
        public long expiresInSeconds() {
            return Math.max(0, Duration.between(Instant.now(), accessTokenExpiresAt).getSeconds());
        }
    }

    AuthResult register(String email, String username, String rawPassword);

    AuthResult login(String email, String rawPassword);

    AuthResult refresh(String rawRefreshToken);

    void logout(String rawRefreshToken);
}
