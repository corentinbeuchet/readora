package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WorkTest {

    @Test
    @DisplayName("Author is trimmed, a blank author means unknown, and the demographic is optional")
    void authorIsNormalised() {
        Work work = Work.create("Berserk", "", WorkType.MANGA, WorkStatus.HIATUS, "  Kentaro Miura ", Demographic.SEINEN, null, Set.of());
        assertThat(work.getAuthor()).isEqualTo("Kentaro Miura");
        assertThat(work.getDemographic()).isEqualTo(Demographic.SEINEN);

        Work unknown = Work.create("Anonymous", "", WorkType.COMIC, WorkStatus.ONGOING, "   ", null, null, Set.of());
        assertThat(unknown.getAuthor()).isNull();
        assertThat(unknown.getDemographic()).isNull();
    }

    @Test
    @DisplayName("An author longer than 120 characters is rejected")
    void authorTooLong() {
        assertThatThrownBy(() -> Work.create("T", "", WorkType.MANGA, WorkStatus.ONGOING, "a".repeat(121), null, null, Set.of()))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("120");
    }
}
