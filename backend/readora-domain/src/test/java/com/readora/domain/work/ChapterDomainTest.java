package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
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
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", null);

        assertThatThrownBy(() -> chapter.publish(UserId.of("editor1")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("Cannot publish chapter with zero pages");
    }

    @Test
    @DisplayName("Publishing a chapter with pages registers ChapterPublishedEvent and updates status")
    void publishingValidChapterEmitsEvent() {
        Work work = Work.create("Tower of God", "Synopsis", WorkType.MANHWA, "cover.jpg", Set.of("Action"));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", null);
        chapter.updatePages(List.of(PageAsset.create(1, "page1.webp", "https://cdn.readora.com/p1.webp")));

        chapter.publish(UserId.of("editor1"));

        assertThat(chapter.isPublished()).isTrue();
        assertThat(chapter.getPublishedAt()).isNotNull();
        assertThat(chapter.getDomainEvents()).hasSize(2); // updatePages event + publish event
        assertThat(chapter.getDomainEvents().get(1)).isInstanceOf(ChapterPublishedEvent.class);
    }
}
