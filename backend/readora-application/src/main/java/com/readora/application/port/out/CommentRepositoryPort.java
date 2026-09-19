package com.readora.application.port.out;

import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.common.UserId;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CommentRepositoryPort {
    Optional<ChapterComment> findById(CommentId id);
    /// Visible comments of the chapter (hidden ones are left out), oldest first.
    List<ChapterComment> findByChapterId(ChapterId chapterId);

    /// When the author last commented, for the comment rate limit.
    Optional<Instant> findLatestCommentTime(UserId authorId);
    ChapterComment save(ChapterComment comment);

    /// Records `voterId`'s upvote and increments the counter atomically. Idempotent per user.
    ///
    /// @return whether this call counted a new vote, and the comment's upvote total afterwards
    UpvoteResult addUpvote(CommentId commentId, UserId voterId);

    record UpvoteResult(boolean counted, int upvotes) {}
}
