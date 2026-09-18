package com.readora.application.port.out;

import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.common.UserId;

import java.util.List;
import java.util.Optional;

public interface CommentRepositoryPort {
    Optional<ChapterComment> findById(CommentId id);
    List<ChapterComment> findByChapterId(ChapterId chapterId);
    ChapterComment save(ChapterComment comment);

    /// Records `voterId`'s upvote and increments the counter atomically. Idempotent per user.
    ///
    /// @return whether this call counted a new vote, and the comment's upvote total afterwards
    UpvoteResult addUpvote(CommentId commentId, UserId voterId);

    record UpvoteResult(boolean counted, int upvotes) {}
}
