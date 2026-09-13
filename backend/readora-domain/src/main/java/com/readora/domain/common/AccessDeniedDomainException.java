package com.readora.domain.common;

public class AccessDeniedDomainException extends RuntimeException {
    public AccessDeniedDomainException(String message) {
        super(message);
    }
}
