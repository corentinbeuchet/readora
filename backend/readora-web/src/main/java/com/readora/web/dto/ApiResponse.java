package com.readora.web.dto;

import org.jspecify.annotations.Nullable;

import java.time.Instant;

/// The one response envelope. On failure, `error` is an English message (logs, older clients) and `code` a stable
/// `ErrorCodes` value the frontend translates (US-13).
public record ApiResponse<T>(
        boolean success,
        @Nullable T data,
        @Nullable String error,
        @Nullable String code,
        Instant timestamp
) {
    public static <T> ApiResponse<T> ok(@Nullable T data) {
        return new ApiResponse<>(true, data, null, null, Instant.now());
    }

    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, null, message, code, Instant.now());
    }
}
