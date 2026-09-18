package com.readora.web.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/// Counts attempts per key in fixed time windows. Memory stays bounded: expired windows are dropped whenever the
/// map grows past [#PRUNE_THRESHOLD] keys.
public final class FixedWindowRateLimiter {

    static final int PRUNE_THRESHOLD = 10_000;

    private record Window(Instant start, int count) {}

    private final int maxAttempts;
    private final Duration window;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public FixedWindowRateLimiter(int maxAttempts, Duration window, Clock clock) {
        this.maxAttempts = maxAttempts;
        this.window = window;
        this.clock = clock;
    }

    /// @return true if the attempt is allowed, false if `key` exceeded `maxAttempts` in the current window
    public boolean tryAcquire(String key) {
        Instant now = Instant.now(clock);
        if (windows.size() > PRUNE_THRESHOLD) {
            windows.values().removeIf(w -> !w.start().plus(window).isAfter(now));
        }
        Window updated = windows.compute(key, (_, current) ->
                current == null || !current.start().plus(window).isAfter(now)
                        ? new Window(now, 1)
                        : new Window(current.start(), current.count() + 1));
        return updated.count() <= maxAttempts;
    }

    /// Seconds until the window of `key` resets (for `Retry-After`).
    public long secondsUntilReset(String key) {
        Window current = windows.get(key);
        if (current == null) {
            return 0;
        }
        return Math.max(1, Duration.between(Instant.now(clock), current.start().plus(window)).toSeconds());
    }
}
