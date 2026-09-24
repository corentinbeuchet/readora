package com.readora.web.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/// Brute-force protection for the credential endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`,
/// `/auth/password`, `/auth/password-reset`, `/auth/password-reset/confirm`, `/auth/delete-account`).
@ConfigurationProperties(prefix = "readora.security.rate-limit")
public record RateLimitProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("10") int maxAttempts,
        @DefaultValue("PT1M") Duration window
) {}
