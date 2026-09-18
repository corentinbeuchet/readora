package com.readora.application.service;

import com.readora.application.port.out.BookmarkRepositoryPort;
import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentPostedEvent;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReaderSocialServiceTest {

    @Mock
    private CommentRepositoryPort commentRepository;

    @Mock
    private BookmarkRepositoryPort bookmarkRepository;

    @Mock
    private EventPublisherPort eventPublisher;

    private ReaderSocialService service;

    @BeforeEach
    void setUp() {
        service = new ReaderSocialService(commentRepository, bookmarkRepository, eventPublisher);
        when(commentRepository.save(any(ChapterComment.class))).thenAnswer(i -> rebuilt(i.getArgument(0)));
    }

    @Test
    @DisplayName("Posting a root comment publishes CommentPostedEvent even though save returns a rebuilt copy")
    void rootCommentPublishesEvent() {
        service.postRootComment(ChapterId.generate(), UserId.of("reader-1"), "reader", "Great chapter!", null, false);

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

    /// Mimics the JPA adapter: `save` returns a new instance rebuilt from state, without pending events.
    private static ChapterComment rebuilt(ChapterComment c) {
        return new ChapterComment(c.getId(), c.getChapterId(), c.getAuthorId(), c.getAuthorUsername(), c.getContent(),
                c.getPageReference(), c.getParentId(), c.getDepth(), c.isSpoiler(), c.getUpvotes(), c.getCreatedAt());
    }
}
