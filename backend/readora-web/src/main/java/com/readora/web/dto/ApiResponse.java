package com.readora.web.dto;

import org.jspecify.annotations.Nullable;

/// The one response envelope. On failure, `error` is an English message (logs, older clients) and `code` a stable
/// `ErrorCodes` value the frontend translates (US-13). No per-response timestamp (the `Date` header has the time): an
/// unchanged answer must be byte-identical, or its ETag never matches (`PublicApiCachingFilter`).
public record ApiResponse<T>(
        boolean success,
        @Nullable T data,
        @Nullable String error,
        @Nullable String code
) {
    public static <T> ApiResponse<T> ok(@Nullable T data) {
        return new ApiResponse<>(true, data, null, null);
    }

    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, null, message, code);
    }
}
