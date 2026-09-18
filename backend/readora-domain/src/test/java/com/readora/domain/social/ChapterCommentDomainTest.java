package com.readora.domain.social;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.work.ChapterId;
import com.readora.domain.common.UserId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChapterCommentDomainTest {

    @Test
    @DisplayName("Creating reply that exceeds maximum depth limit throws DomainValidationException")
    void nestingExceedingDepthLimitThrowsException() {
        ChapterId chapterId = ChapterId.generate();
        ChapterComment root = ChapterComment.createRoot(chapterId, UserId.of("u1"), "u1", "Root", null, false);
        ChapterComment l2 = ChapterComment.createReply(root, UserId.of("u2"), "u2", "Level 2", false);
        ChapterComment l3 = ChapterComment.createReply(l2, UserId.of("u3"), "u3", "Level 3", false);
        ChapterComment l4 = ChapterComment.createReply(l3, UserId.of("u4"), "u4", "Level 4", false);
        ChapterComment l5 = ChapterComment.createReply(l4, UserId.of("u5"), "u5", "Level 5", false);

        assertThatThrownBy(() -> ChapterComment.createReply(l5, UserId.of("u6"), "u6", "Level 6", false))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("Comment thread nesting exceeds maximum limit");
    }

    @Test
    @DisplayName("Comment text is stored trimmed")
    void contentIsTrimmed() {
        assertThat(CommentContent.of("  Great chapter!  ").value()).isEqualTo("Great chapter!");
    }

    @Test
    @DisplayName("Authors cannot upvote their own comment; other readers can")
    void authorsCannotUpvoteOwnComment() {
        ChapterComment root = ChapterComment.createRoot(ChapterId.generate(), UserId.of("u1"), "u1", "Root", null, false);

        assertThatThrownBy(() -> root.ensureCanBeUpvotedBy(UserId.of("u1")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("own comment");
        root.ensureCanBeUpvotedBy(UserId.of("u2"));
        assertThat(root.getUpvotes()).isZero();
    }
}
