package com.readora.infrastructure.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/// Background jobs (e.g. [com.readora.infrastructure.security.RefreshTokenCleanupJob]); off with `readora.jobs.enabled=false`.
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "readora.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}
