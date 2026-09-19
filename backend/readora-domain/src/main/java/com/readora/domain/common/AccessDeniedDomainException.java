package com.readora.domain.common;

public class AccessDeniedDomainException extends RuntimeException implements CodedException {
    public AccessDeniedDomainException(String message) {
        super(message);
    }

    @Override
    public String code() {
        return ErrorCodes.FORBIDDEN;
    }
}
