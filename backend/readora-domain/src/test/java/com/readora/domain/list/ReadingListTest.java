package com.readora.domain.list;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.UserId;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReadingListTest {

    private static final Instant NOW = Instant.parse("2026-09-10T10:00:00Z");
    private final WorkId solo = WorkId.generate();

    @Test
    @DisplayName("A list needs a title, holds each series once, and adding a series again updates its note")
    void rules() {
        assertThatThrownBy(() -> ReadingList.create(UserId.of("k"), "k", " ", "", List.of(), false, NOW)).isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> ReadingList.create(UserId.of("k"), "k", "T", "", List.of(new ListItem(solo, null), new ListItem(solo, "x")), false, NOW))
                .isInstanceOf(DomainValidationException.class)
                .satisfies(e -> assertThat(((CodedException) e).code()).isEqualTo(ErrorCodes.LIST_DUPLICATE_SERIES));

        ReadingList list = ReadingList.create(UserId.of("k"), "k", "Peak Webtoons", "", List.of(new ListItem(solo, "Art")), false, NOW);
        list.add(new ListItem(solo, "Masterpiece dungeon art"), NOW);
        assertThat(list.getItems()).singleElement().extracting(ListItem::note).isEqualTo("Masterpiece dungeon art");
        assertThatThrownBy(() -> new ListItem(solo, "x".repeat(301))).isInstanceOf(DomainValidationException.class);
    }
}
