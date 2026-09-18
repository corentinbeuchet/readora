package com.readora.web.dto;

import org.jspecify.annotations.Nullable;

import java.time.Instant;

public record ApiResponse<T>(
        boolean success,
        @Nullable T data,
        @Nullable String error,
        Instant timestamp
) {
    public static <T> ApiResponse<T> ok(@Nullable T data) {
        return new ApiResponse<>(true, data, null, Instant.now());
    }

    public static <T> ApiResponse<T> error(@Nullable String message) {
        return new ApiResponse<>(false, null, message, Instant.now());
    }
}
