package com.readora.infrastructure.security;

import com.readora.application.port.out.RefreshTokenRepositoryPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class RefreshTokenCleanupJobTest {

    @Test
    @DisplayName("Deletes refresh tokens that expired more than a day ago")
    void deletesTokensExpiredBeforeRetention() {
        RefreshTokenRepositoryPort repository = mock(RefreshTokenRepositoryPort.class);
        Instant now = Instant.parse("2026-09-18T03:17:00Z");

        new RefreshTokenCleanupJob(repository, Clock.fixed(now, ZoneOffset.UTC)).deleteExpiredTokens();

        verify(repository).deleteExpiredBefore(Instant.parse("2026-09-17T03:17:00Z"));
    }
}
