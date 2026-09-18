package com.readora.domain.common;

/// A referenced aggregate or entity does not exist. The web layer maps it to HTTP 404.
public class NotFoundException extends RuntimeException {
    public NotFoundException(String entityType, Object id) {
        super(entityType + " not found: " + id);
    }
}
