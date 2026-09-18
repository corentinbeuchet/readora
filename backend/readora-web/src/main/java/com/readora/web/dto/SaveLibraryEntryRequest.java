package com.readora.web.dto;

import com.readora.domain.social.ReadingStatus;
import org.jspecify.annotations.Nullable;

/// @param status omitted = `READING` for a new entry, unchanged for an existing one
public record SaveLibraryEntryRequest(@Nullable ReadingStatus status) {
}
