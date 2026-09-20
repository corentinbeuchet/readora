package com.readora.application.service;

import com.readora.application.port.out.ChapterReadRepositoryPort;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.WorkId;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReadingTrackerServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-10T08:00:00Z");

    @Mock
    private ChapterReadRepositoryPort reads;

    @Mock
    private ChapterRepositoryPort chapters;

    @Mock
    private WorkRepositoryPort works;

    private ReadingTrackerService service;
    private final UserId kenji = UserId.of("kenji");
    private final WorkId work = WorkId.generate();

    @BeforeEach
    void setUp() {
        service = new ReadingTrackerService(reads, chapters, works, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private Chapter published(String number) {
        Chapter chapter = Chapter.createDraft(work, ChapterNumber.of(number), "Ch " + number, TeamId.generate());
        chapter.updatePages(List.of(PageAsset.create(1, "p.webp", null)));
        chapter.publish(UserId.of("qc"));
        return chapter;
    }

    @Test
    @DisplayName("Reading a draft chapter is refused as not found and nothing is recorded")
    void draftChapterIsNotRecorded() {
        Chapter draft = Chapter.createDraft(work, ChapterNumber.of("9"), "Draft", TeamId.generate());
        when(chapters.findById(draft.getId())).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> service.recordRead(kenji, draft.getId(), false)).isInstanceOf(NotFoundException.class);
        verify(reads, never()).save(any());
    }

    @Test
    @DisplayName("A first visit is recorded with the chapter number and the current time")
    void firstVisitIsRecorded() {
        Chapter chapter = published("3");
        when(chapters.findById(chapter.getId())).thenReturn(Optional.of(chapter));
        when(reads.find(kenji, chapter.getId())).thenReturn(Optional.empty());
        when(reads.save(any())).thenAnswer(i -> i.getArgument(0));

        ChapterRead read = service.recordRead(kenji, chapter.getId(), false);

        assertThat(read.chapterNumber().value()).isEqualTo("3");
        assertThat(read.readAt()).isEqualTo(NOW);
        assertThat(read.finished()).isFalse();
    }

    @Test
    @DisplayName("Progress: nothing finished points at the first chapter; everything finished points at nothing")
    void nextToReadAtTheEdges() {
        Chapter one = published("1");
        Chapter two = published("2");
        when(chapters.findPublishedByWorkId(work)).thenReturn(List.of(one, two));

        when(reads.findByUserAndWork(kenji, work)).thenReturn(List.of());
        assertThat(service.progress(kenji, work).nextToRead()).isEqualTo(one.getId());

        when(reads.findByUserAndWork(kenji, work)).thenReturn(List.of(
                new ChapterRead(kenji, work, one.getId(), one.getChapterNumber(), NOW, true),
                new ChapterRead(kenji, work, two.getId(), two.getChapterNumber(), NOW, true)));
        assertThat(service.progress(kenji, work).nextToRead()).isNull();
    }

    @Test
    @DisplayName("Progress: an opened but unfinished chapter is not marked as read")
    void openedIsNotFinished() {
        Chapter one = published("1");
        when(chapters.findPublishedByWorkId(work)).thenReturn(List.of(one));
        when(reads.findByUserAndWork(kenji, work)).thenReturn(List.of(new ChapterRead(kenji, work, one.getId(), one.getChapterNumber(), NOW, false)));

        var progress = service.progress(kenji, work);

        assertThat(progress.finished()).isEmpty();
        assertThat(progress.nextToRead()).isEqualTo(one.getId());
    }

    @Test
    @DisplayName("History size is clamped between 1 and the maximum")
    void historyLimitIsClamped() {
        when(reads.findLatestPerWork(eq(kenji), any(Integer.class))).thenReturn(List.of());

        service.history(kenji, 10_000);
        verify(reads).findLatestPerWork(kenji, 50);

        service.history(kenji, -1);
        verify(reads).findLatestPerWork(kenji, 1);
    }
}
