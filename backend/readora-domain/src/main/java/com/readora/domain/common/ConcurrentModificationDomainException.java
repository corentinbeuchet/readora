package com.readora.domain.common;

/// Thrown when an aggregate was changed by someone else between load and save (optimistic locking).
/// Callers should reload and retry the use case; the web layer maps it to HTTP 409.
public class ConcurrentModificationDomainException extends RuntimeException {
    public ConcurrentModificationDomainException(String aggregateType, Object id) {
        super(aggregateType + " " + id + " was modified concurrently; reload and try again");
    }
}
