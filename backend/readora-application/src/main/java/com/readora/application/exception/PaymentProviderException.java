package com.readora.application.exception;

/// The payment provider failed or rejected a request. Mapped to HTTP 502.
public class PaymentProviderException extends RuntimeException {
    public PaymentProviderException(String message, Throwable cause) {
        super(message, cause);
    }
}
