package com.readora.infrastructure.security;

import com.readora.application.port.out.RefreshTokenRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/// Deletes refresh tokens that expired more than a day ago, so the table does not grow forever.
/// Disabled with `readora.jobs.enabled=false` (tests).
@Component
@ConditionalOnProperty(name = "readora.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class RefreshTokenCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenCleanupJob.class);
    static final Duration RETENTION_AFTER_EXPIRY = Duration.ofDays(1);

    private final RefreshTokenRepositoryPort refreshTokenRepository;
    private final Clock clock;

    /// The constructor Spring uses (the other one exists for tests with a fixed clock).
    @Autowired
    public RefreshTokenCleanupJob(RefreshTokenRepositoryPort refreshTokenRepository) {
        this(refreshTokenRepository, Clock.systemUTC());
    }

    RefreshTokenCleanupJob(RefreshTokenRepositoryPort refreshTokenRepository, Clock clock) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.clock = clock;
    }

    @Scheduled(cron = "${readora.jobs.refresh-token-cleanup-cron:0 17 3 * * *}")
    public void deleteExpiredTokens() {
        Instant threshold = Instant.now(clock).minus(RETENTION_AFTER_EXPIRY);
        refreshTokenRepository.deleteExpiredBefore(threshold);
        log.info("Deleted refresh tokens that expired before {}", threshold);
    }
}
