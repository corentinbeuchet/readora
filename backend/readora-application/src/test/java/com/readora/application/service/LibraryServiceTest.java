package com.readora.application.service;

import com.readora.application.port.out.ChapterReadRepositoryPort;
import com.readora.application.port.out.LibraryRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LibraryServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-10T08:00:00Z");

    @Mock
    private LibraryRepositoryPort library;

    @Mock
    private WorkRepositoryPort works;

    @Mock
    private ChapterReadRepositoryPort reads;

    private LibraryService service;
    private final UserId kenji = UserId.of("kenji");
    private final Work solo = Work.create("Solo Leveling", "", WorkType.MANHWA, "", Set.of());

    @BeforeEach
    void setUp() {
        service = new LibraryService(library, works, reads, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    @DisplayName("Adding an unknown series is a not-found error and saves nothing")
    void unknownWork() {
        WorkId missing = WorkId.generate();
        when(works.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.save(kenji, missing, null)).isInstanceOf(NotFoundException.class);
        verify(library, never()).save(any());
    }

    @Test
    @DisplayName("Saving again without a status keeps the existing status")
    void saveWithoutStatusKeepsIt() {
        when(works.findById(solo.getId())).thenReturn(Optional.of(solo));
        LibraryEntry planned = LibraryEntry.add(kenji, solo.getId(), ReadingStatus.PLAN_TO_READ, NOW.minusSeconds(60));
        when(library.find(kenji, solo.getId())).thenReturn(Optional.of(planned));
        when(library.save(any())).thenAnswer(i -> i.getArgument(0));

        assertThat(service.save(kenji, solo.getId(), null).getStatus()).isEqualTo(ReadingStatus.PLAN_TO_READ);
    }

    @Test
    @DisplayName("Removing a series that is not in the library is a not-found error")
    void removeMissing() {
        when(library.delete(kenji, solo.getId())).thenReturn(false);

        assertThatThrownBy(() -> service.remove(kenji, solo.getId())).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("Listing joins works and new-chapter counts, and skips entries whose work no longer exists")
    void listJoinsWorks() {
        WorkId deleted = WorkId.generate();
        when(library.findByUser(kenji, null)).thenReturn(List.of(
                LibraryEntry.add(kenji, solo.getId(), ReadingStatus.READING, NOW),
                LibraryEntry.add(kenji, deleted, ReadingStatus.READING, NOW)));
        when(works.findAllById(List.of(solo.getId(), deleted))).thenReturn(List.of(solo));
        when(reads.countChaptersPublishedSinceLastRead(kenji, List.of(solo.getId(), deleted))).thenReturn(Map.of(solo.getId(), 2L));

        var items = service.list(kenji, null);

        assertThat(items).singleElement().satisfies(item -> {
            assertThat(item.work().getTitle()).isEqualTo("Solo Leveling");
            assertThat(item.newChapters()).isEqualTo(2);
        });
    }
}
