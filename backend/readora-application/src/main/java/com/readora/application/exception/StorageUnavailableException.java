package com.readora.application.exception;

/// The storage backend could not complete the operation; nothing was stored. Mapped to HTTP 503.
public class StorageUnavailableException extends RuntimeException {
    public StorageUnavailableException(String message) {
        super(message);
    }
}
