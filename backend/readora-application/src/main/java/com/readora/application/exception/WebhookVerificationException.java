package com.readora.application.exception;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.ErrorCodes;

import org.jspecify.annotations.Nullable;

/// A provider webhook could not be authenticated (bad/missing signature or no secret). Mapped to HTTP 400.
public class WebhookVerificationException extends RuntimeException implements CodedException {
    public WebhookVerificationException(String message, @Nullable Throwable cause) {
        super(message, cause);
    }

    @Override
    public String code() {
        return ErrorCodes.WEBHOOK_REJECTED;
    }
}
