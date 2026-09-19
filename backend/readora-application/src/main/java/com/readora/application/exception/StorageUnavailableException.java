package com.readora.application.exception;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.ErrorCodes;

/// The storage backend could not complete the operation; nothing was stored. Mapped to HTTP 503.
public class StorageUnavailableException extends RuntimeException implements CodedException {
    public StorageUnavailableException(String message) {
        super(message);
    }

    @Override
    public String code() {
        return ErrorCodes.STORAGE_UNAVAILABLE;
    }
}
