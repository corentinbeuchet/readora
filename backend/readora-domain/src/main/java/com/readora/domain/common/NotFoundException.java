package com.readora.domain.common;

/// A referenced aggregate or entity does not exist. The web layer maps it to HTTP 404.
public class NotFoundException extends RuntimeException implements CodedException {
    public NotFoundException(String entityType, Object id) {
        super(entityType + " not found: " + id);
    }

    @Override
    public String code() {
        return ErrorCodes.NOT_FOUND;
    }
}
