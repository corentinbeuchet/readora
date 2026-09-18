package com.readora.application.exception;

/// A provider webhook could not be authenticated (bad/missing signature or no secret). Mapped to HTTP 400.
public class WebhookVerificationException extends RuntimeException {
    public WebhookVerificationException(String message, Throwable cause) {
        super(message, cause);
    }
}
