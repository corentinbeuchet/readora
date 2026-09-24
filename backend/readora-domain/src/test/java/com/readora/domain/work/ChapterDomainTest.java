package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChapterDomainTest {

    @Test
    @DisplayName("Publishing a chapter with zero pages should fail with DomainValidationException")
    void publishingEmptyChapterThrowsException() {
        Work work = Work.create("Tower of God", "Synopsis", WorkType.MANHWA, "cover.jpg", Set.of("Action"));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", TeamId.generate());

        assertThatThrownBy(() -> chapter.publish(UserId.of("editor1")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("Cannot publish chapter with zero pages");
    }

    @Test
    @DisplayName("Publishing an already published chapter is rejected and emits no second event")
    void republishingIsRejected() {
        Chapter chapter = Chapter.createDraft(WorkId.generate(), ChapterNumber.of("1"), "Chapter 1", TeamId.generate());
        chapter.updatePages(List.of(PageAsset.create(1, "page1.webp", null)));
        chapter.publish(UserId.of("editor1"));
        chapter.pollDomainEvents();

        assertThatThrownBy(() -> chapter.publish(UserId.of("editor1")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("already published");
        assertThat(chapter.pollDomainEvents()).isEmpty();
    }

    @Test
    @DisplayName("Publishing a chapter with pages registers ChapterPublishedEvent and updates status")
    void publishingValidChapterEmitsEvent() {
        Work work = Work.create("Tower of God", "Synopsis", WorkType.MANHWA, "cover.jpg", Set.of("Action"));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", TeamId.generate());
        chapter.updatePages(List.of(PageAsset.create(1, "page1.webp", "https://cdn.readora.com/p1.webp")));

        chapter.publish(UserId.of("editor1"));

        assertThat(chapter.isPublished()).isTrue();
        assertThat(chapter.getPublishedAt()).isNotNull();
        assertThat(chapter.getDomainEvents()).singleElement().isInstanceOf(ChapterPublishedEvent.class);
    }
    @Test
    @DisplayName("A chapter released for review waits hidden, and nobody is told until a moderator approves it")
    void aReviewedChapterGoesLiveOnApproval() {
        Chapter chapter = aDraftWithPages();

        chapter.release(UserId.of("leader"), true);

        assertThat(chapter.getStatus()).isEqualTo(ChapterStatus.PENDING_REVIEW);
        assertThat(chapter.isPublished()).isFalse();
        assertThat(chapter.pollDomainEvents()).isEmpty();

        chapter.approve();

        assertThat(chapter.isPublished()).isTrue();
        assertThat(chapter.getPublishedAt()).isNotNull();
        assertThat(chapter.pollDomainEvents()).singleElement().isInstanceOf(ChapterPublishedEvent.class);
    }

    @Test
    @DisplayName("A chapter sent back becomes a draft again and its team is told; it can then be released again")
    void aChapterSentBackCanComeAgain() {
        Chapter chapter = aDraftWithPages();
        chapter.release(UserId.of("leader"), true);

        chapter.sendBack();

        assertThat(chapter.getStatus()).isEqualTo(ChapterStatus.DRAFT);
        assertThat(chapter.pollDomainEvents()).singleElement().isInstanceOf(ChapterSentBackEvent.class);
        chapter.release(UserId.of("leader"), true);
        assertThat(chapter.isWaitingForReview()).isTrue();
    }

    @Test
    @DisplayName("Only a chapter waiting for review can be approved or sent back, and a waiting chapter is not released twice")
    void reviewNeedsAWaitingChapter() {
        Chapter draft = aDraftWithPages();
        Chapter published = aDraftWithPages();
        published.release(UserId.of("leader"), false);
        Chapter waiting = aDraftWithPages();
        waiting.release(UserId.of("leader"), true);

        assertThatThrownBy(draft::approve).isInstanceOfSatisfying(DomainValidationException.class,
                e -> assertThat(e.code()).isEqualTo(ErrorCodes.CHAPTER_NOT_WAITING));
        assertThatThrownBy(published::sendBack).isInstanceOfSatisfying(DomainValidationException.class,
                e -> assertThat(e.code()).isEqualTo(ErrorCodes.CHAPTER_NOT_WAITING));
        assertThatThrownBy(() -> waiting.release(UserId.of("leader"), false)).isInstanceOf(DomainValidationException.class);
        assertThat(published.isPublished()).isTrue();
    }

    private static Chapter aDraftWithPages() {
        Chapter chapter = Chapter.createDraft(WorkId.generate(), ChapterNumber.of("1"), "Ch 1", TeamId.generate());
        chapter.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        return chapter;
    }
}
