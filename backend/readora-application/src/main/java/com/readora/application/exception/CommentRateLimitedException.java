package com.readora.application.exception;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.ErrorCodes;

/// The author commented too recently (anti-spam, US-11). The web layer answers 429 with `Retry-After`.
public class CommentRateLimitedException extends RuntimeException implements CodedException {
    private final long waitSeconds;

    public CommentRateLimitedException(long waitSeconds) {
        super("Please wait " + waitSeconds + " seconds before commenting again");
        this.waitSeconds = waitSeconds;
    }

    /// Seconds until the author may comment again (at least 1).
    public long waitSeconds() {
        return waitSeconds;
    }

    @Override
    public String code() {
        return ErrorCodes.RATE_LIMITED;
    }
}
