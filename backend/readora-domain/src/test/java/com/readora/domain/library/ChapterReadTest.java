package com.readora.domain.library;

import com.readora.domain.common.UserId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ChapterReadTest {

    private final Instant monday = Instant.parse("2026-09-07T10:00:00Z");
    private final ChapterRead finishedMonday = new ChapterRead(UserId.of("kenji"), WorkId.generate(), ChapterId.generate(),
            ChapterNumber.of("5"), monday, true);

    @Test
    @DisplayName("Re-opening a finished chapter keeps it finished and moves the last visit forward")
    void revisitKeepsFinished() {
        ChapterRead tuesday = finishedMonday.revisit(monday.plusSeconds(86_400), false);

        assertThat(tuesday.finished()).isTrue();
        assertThat(tuesday.readAt()).isEqualTo(monday.plusSeconds(86_400));
    }

    @Test
    @DisplayName("A visit dated before the last one never moves the last visit backwards")
    void revisitNeverGoesBack() {
        assertThat(finishedMonday.revisit(monday.minusSeconds(60), false).readAt()).isEqualTo(monday);
    }
}
