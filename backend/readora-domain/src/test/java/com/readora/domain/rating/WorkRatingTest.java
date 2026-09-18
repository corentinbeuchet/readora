package com.readora.domain.rating;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WorkRatingTest {

    private static final Instant NOW = Instant.parse("2026-09-10T10:00:00Z");

    @Test
    @DisplayName("Scores go from 1 to 10 and can be changed")
    void scoreRange() {
        WorkRating rating = WorkRating.rate(UserId.of("kenji"), WorkId.generate(), 9, NOW);
        rating.changeScore(10, NOW.plusSeconds(1));
        assertThat(rating.getScore()).isEqualTo(10);

        assertThatThrownBy(() -> rating.changeScore(0, NOW)).isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> WorkRating.rate(UserId.of("kenji"), WorkId.generate(), 11, NOW)).isInstanceOf(DomainValidationException.class);
    }

    @Test
    @DisplayName("A review needs a verdict; blank optional parts become empty; parts are limited to 2000 characters")
    void reviewRules() {
        Review review = new Review("  Art  ", " ", "A classic");
        assertThat(review.liked()).isEqualTo("Art");
        assertThat(review.disliked()).isNull();

        assertThatThrownBy(() -> new Review("x", "y", " ")).isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new Review("x".repeat(2001), null, "ok")).isInstanceOf(DomainValidationException.class);
    }
}
