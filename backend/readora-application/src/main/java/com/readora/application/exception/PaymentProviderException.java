package com.readora.application.exception;

import org.jspecify.annotations.Nullable;

/// The payment provider failed or rejected a request. Mapped to HTTP 502.
public class PaymentProviderException extends RuntimeException {
    public PaymentProviderException(String message, @Nullable Throwable cause) {
        super(message, cause);
    }
}
