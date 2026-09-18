package com.readora.web;

import com.readora.infrastructure.security.RefreshTokenCleanupJob;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/// The test profile switches background jobs off, so the regular web tests never build them. This test starts the
/// application with jobs on, like staging/production do, so a job that Spring cannot instantiate fails the build
/// instead of the deployment.
@SpringBootTest(classes = ReadoraApplication.class)
@ActiveProfiles("test")
@TestPropertySource(properties = "readora.jobs.enabled=true")
class JobsEnabledContextTest {

    @Autowired
    private RefreshTokenCleanupJob refreshTokenCleanupJob;

    @Test
    @DisplayName("The application starts with background jobs enabled and the cleanup job runs")
    void applicationStartsWithJobsEnabled() {
        assertThat(refreshTokenCleanupJob).isNotNull();
        refreshTokenCleanupJob.deleteExpiredTokens();
    }
}
