package com.readora.web.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class FixedWindowRateLimiterTest {

    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-09-18T10:00:00Z"));
    private final Clock clock = new Clock() {
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
    };

    @Test
    @DisplayName("Allows maxAttempts per key and window, then blocks until the window resets")
    void blocksAfterMaxAttemptsUntilReset() {
        FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(3, Duration.ofMinutes(1), clock);

        assertThat(limiter.tryAcquire("ip|login")).isTrue();
        assertThat(limiter.tryAcquire("ip|login")).isTrue();
        assertThat(limiter.tryAcquire("ip|login")).isTrue();
        assertThat(limiter.tryAcquire("ip|login")).isFalse();
        assertThat(limiter.tryAcquire("other-ip|login")).isTrue();
        assertThat(limiter.secondsUntilReset("ip|login")).isEqualTo(60);

        now.set(now.get().plusSeconds(61));
        assertThat(limiter.tryAcquire("ip|login")).isTrue();
    }
}
