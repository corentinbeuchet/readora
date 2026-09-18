package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChapterNumberTest {

    @Test
    @DisplayName("Numeric chapter numbers are canonical: 1, 01, 1.0 and ' 1 ' are the same chapter")
    void numericFormsAreCanonical() {
        assertThat(ChapterNumber.of("01")).isEqualTo(ChapterNumber.of("1"));
        assertThat(ChapterNumber.of("1.0")).isEqualTo(ChapterNumber.of("1"));
        assertThat(ChapterNumber.of(" 1 ").value()).isEqualTo("1");
        assertThat(ChapterNumber.of("10.50").value()).isEqualTo("10.5");
        assertThat(ChapterNumber.of("0").value()).isEqualTo("0");
        assertThat(ChapterNumber.of(2.0).value()).isEqualTo("2");
    }

    @Test
    @DisplayName("Labels are kept as written and sort after numbers")
    void labelsSortAfterNumbers() {
        List<ChapterNumber> sorted = List.of(ChapterNumber.of("Extra"), ChapterNumber.of("10"), ChapterNumber.of("2"),
                ChapterNumber.of("1.5"), ChapterNumber.of("Afterword")).stream().sorted().toList();

        assertThat(sorted).extracting(ChapterNumber::value).containsExactly("1.5", "2", "10", "Afterword", "Extra");
        assertThat(ChapterNumber.of("Extra").compareTo(ChapterNumber.of("Prologue"))).isNotZero();
    }

    @Test
    @DisplayName("Blank or over-long chapter numbers are rejected")
    void invalidNumbersAreRejected() {
        assertThatThrownBy(() -> ChapterNumber.of("  ")).isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> ChapterNumber.of("x".repeat(51))).isInstanceOf(DomainValidationException.class);
    }
}
