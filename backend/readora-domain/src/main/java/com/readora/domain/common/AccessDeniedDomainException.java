package com.readora.domain.common;

public class AccessDeniedDomainException extends RuntimeException implements CodedException {
    private final String code;

    public AccessDeniedDomainException(String message) {
        this(ErrorCodes.FORBIDDEN, message);
    }

    private AccessDeniedDomainException(String code, String message) {
        super(message);
        this.code = code;
    }

    /// A refusal the reader should understand (an admin suspended the account…), translated by `code`.
    public static AccessDeniedDomainException withCode(String code, String message) {
        return new AccessDeniedDomainException(code, message);
    }

    @Override
    public String code() {
        return code;
    }
}
