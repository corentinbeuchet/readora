package com.readora.application.service;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentPostedEvent;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.WorkId;
import com.readora.domain.common.UserId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReaderSocialServiceTest {

    @Mock
    private CommentRepositoryPort commentRepository;

    @Mock
    private ChapterRepositoryPort chapterRepository;

    @Mock
    private EventPublisherPort eventPublisher;

    private ReaderSocialService service;

    @BeforeEach
    void setUp() {
        service = new ReaderSocialService(commentRepository, chapterRepository, eventPublisher);
        lenient().when(commentRepository.save(any(ChapterComment.class))).thenAnswer(i -> rebuilt(i.getArgument(0)));
    }

    @Test
    @DisplayName("Posting a root comment publishes CommentPostedEvent even though save returns a rebuilt copy")
    void rootCommentPublishesEvent() {
        Chapter chapter = publishedChapter();
        when(chapterRepository.findById(chapter.getId())).thenReturn(Optional.of(chapter));

        service.postRootComment(chapter.getId(), UserId.of("reader-1"), "reader", "Great chapter!", null, false);

        verify(eventPublisher).publish(any(CommentPostedEvent.class));
    }

    @Test
    @DisplayName("Replying to a comment publishes CommentPostedEvent even though save returns a rebuilt copy")
    void replyPublishesEvent() {
        ChapterComment parent = ChapterComment.createRoot(ChapterId.generate(), UserId.of("reader-1"), "reader", "First!", null, false);
        parent.pollDomainEvents();
        when(commentRepository.findById(parent.getId())).thenReturn(Optional.of(parent));

        service.replyToComment(parent.getId(), UserId.of("reader-2"), "other", "Agreed", false);

        verify(eventPublisher).publish(any(CommentPostedEvent.class));
    }

    @Test
    @DisplayName("Commenting on a draft chapter is rejected and nothing is saved")
    void commentOnDraftChapterIsRejected() {
        Chapter draft = Chapter.createDraft(WorkId.generate(), ChapterNumber.of("1"), "Draft", TeamId.generate());
        when(chapterRepository.findById(draft.getId())).thenReturn(Optional.of(draft));

        assertThatThrownBy(() ->
                        service.postRootComment(draft.getId(), UserId.of("reader-1"), "reader", "Spoiler!", null, false))
                .isInstanceOf(DomainValidationException.class);
        verify(commentRepository, never()).save(any());
    }

    private static Chapter publishedChapter() {
        Chapter chapter = Chapter.createDraft(WorkId.generate(), ChapterNumber.of("1"), "Chapter 1", TeamId.generate());
        chapter.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        chapter.publish(UserId.of("publisher"));
        return chapter;
    }

    /// Mimics the JPA adapter: `save` returns a new instance rebuilt from state, without pending events.
    private static ChapterComment rebuilt(ChapterComment c) {
        return new ChapterComment(c.getId(), c.getChapterId(), c.getAuthorId(), c.getAuthorUsername(), c.getContent(),
                c.getPageReference(), c.getParentId(), c.getDepth(), c.isSpoiler(), c.getUpvotes(), c.getCreatedAt());
    }
}
