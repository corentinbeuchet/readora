package com.readora.domain.list;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.util.Objects;

/// A series in a list, with the owner's note about it.
public record ListItem(WorkId workId, @Nullable String note) {
    public static final int MAX_NOTE = 300;

    public ListItem {
        Objects.requireNonNull(workId, "WorkId cannot be null");
        note = note == null || note.isBlank() ? null : note.trim();
        if (note != null && note.length() > MAX_NOTE) {
            throw new DomainValidationException("A note cannot exceed " + MAX_NOTE + " characters");
        }
    }
}
