package com.readora.application.service;

import com.readora.application.port.out.RatingRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.rating.Review;
import com.readora.domain.rating.WorkRating;
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
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RatingServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-10T10:00:00Z");

    @Mock
    private RatingRepositoryPort ratings;

    @Mock
    private WorkRepositoryPort works;

    private RatingService service;
    private final UserId kenji = UserId.of("kenji");
    private final Work berserk = Work.create("Berserk", "", WorkType.MANGA, "", Set.of());

    @BeforeEach
    void setUp() {
        service = new RatingService(ratings, works, Clock.fixed(NOW, ZoneOffset.UTC));
        lenient().when(works.findById(berserk.getId())).thenReturn(Optional.of(berserk));
        lenient().when(ratings.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    @DisplayName("Rating again changes the existing rating instead of adding one")
    void rateAgain() {
        WorkRating existing = WorkRating.rate(kenji, berserk.getId(), 9, NOW.minusSeconds(60));
        when(ratings.find(kenji, berserk.getId())).thenReturn(Optional.of(existing));

        WorkRating saved = service.rate(kenji, berserk.getId(), 10);

        assertThat(saved.getId()).isEqualTo(existing.getId());
        assertThat(saved.getScore()).isEqualTo(10);
    }

    @Test
    @DisplayName("Rating an unknown series is a not-found error")
    void unknownWork() {
        WorkId missing = WorkId.generate();
        when(works.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rate(kenji, missing, 5)).isInstanceOf(NotFoundException.class);
        verify(ratings, never()).save(any());
    }

    @Test
    @DisplayName("Only reviews can be voted helpful, and never by their author")
    void helpfulRules() {
        WorkRating scoreOnly = WorkRating.rate(UserId.of("aoi"), berserk.getId(), 7, NOW);
        when(ratings.findById(scoreOnly.getId())).thenReturn(Optional.of(scoreOnly));
        assertThatThrownBy(() -> service.markHelpful(kenji, scoreOnly.getId())).isInstanceOf(NotFoundException.class);

        WorkRating own = WorkRating.rate(kenji, berserk.getId(), 9, NOW);
        own.writeReview(new Review(null, null, "Great"), NOW);
        when(ratings.findById(own.getId())).thenReturn(Optional.of(own));
        assertThatThrownBy(() -> service.markHelpful(kenji, own.getId())).isInstanceOf(DomainValidationException.class);
        verify(ratings, never()).addHelpfulVote(any(), any());
    }
}
