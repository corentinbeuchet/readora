package com.readora.application.exception;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.ErrorCodes;

import org.jspecify.annotations.Nullable;

/// The payment provider failed or rejected a request. Mapped to HTTP 502.
public class PaymentProviderException extends RuntimeException implements CodedException {
    public PaymentProviderException(String message, @Nullable Throwable cause) {
        super(message, cause);
    }

    @Override
    public String code() {
        return ErrorCodes.PAYMENT_FAILED;
    }
}
