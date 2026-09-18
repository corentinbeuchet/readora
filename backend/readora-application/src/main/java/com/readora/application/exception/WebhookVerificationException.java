package com.readora.application.exception;

import org.jspecify.annotations.Nullable;

/// A provider webhook could not be authenticated (bad/missing signature or no secret). Mapped to HTTP 400.
public class WebhookVerificationException extends RuntimeException {
    public WebhookVerificationException(String message, @Nullable Throwable cause) {
        super(message, cause);
    }
}
