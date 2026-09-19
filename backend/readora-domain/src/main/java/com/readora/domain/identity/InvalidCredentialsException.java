package com.readora.domain.identity;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.ErrorCodes;

public class InvalidCredentialsException extends RuntimeException implements CodedException {
    private final String code;

    public InvalidCredentialsException(String message) {
        this(ErrorCodes.INVALID_CREDENTIALS, message);
    }

    private InvalidCredentialsException(String code, String message) {
        super(message);
        this.code = code;
    }

    /// The refresh token is missing, unknown, expired or revoked: the reader has to log in again.
    public static InvalidCredentialsException sessionExpired(String message) {
        return new InvalidCredentialsException(ErrorCodes.SESSION_EXPIRED, message);
    }

    @Override
    public String code() {
        return code;
    }
}
