package com.readora.web.dto;

import com.readora.application.port.in.BrowseCatalogUseCase;

import java.util.List;
import java.util.function.Function;

public record PagedResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static <S, T> PagedResponse<T> from(BrowseCatalogUseCase.Page<S> page, Function<S, T> mapper) {
        return new PagedResponse<>(
                page.items().stream().map(mapper).toList(),
                page.page(),
                page.size(),
                page.totalElements(),
                page.totalPages()
        );
    }
}
