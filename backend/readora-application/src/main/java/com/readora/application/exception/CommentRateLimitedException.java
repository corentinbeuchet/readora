package com.readora.application.exception;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.ErrorCodes;

/// The author commented too recently (anti-spam, US-11). The web layer answers 429.
public class CommentRateLimitedException extends RuntimeException implements CodedException {
    public CommentRateLimitedException(long waitSeconds) {
        super("Please wait " + waitSeconds + " seconds before commenting again");
    }

    @Override
    public String code() {
        return ErrorCodes.RATE_LIMITED;
    }
}
