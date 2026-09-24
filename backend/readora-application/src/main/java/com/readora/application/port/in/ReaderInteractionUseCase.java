package com.readora.application.port.in;

import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.common.UserId;

import java.util.List;

public interface ReaderInteractionUseCase {
    ChapterComment postRootComment(ChapterId chapterId, UserId authorId, String username, String text, Integer pageRef, boolean isSpoiler);
    ChapterComment replyToComment(CommentId parentCommentId, UserId authorId, String username, String text, boolean isSpoiler);
    /// One upvote per user per comment; repeating it is a no-op. Authors can't upvote their own comments.
    ///
    /// @return the comment's upvote total and whether this call counted
    UpvoteOutcome upvoteComment(CommentId commentId, UserId voterId);

    record UpvoteOutcome(CommentId commentId, int upvotes, boolean counted) {}
    @ReadOnly
    List<ChapterComment> getCommentsForChapter(ChapterId chapterId);

    int MAX_TOP_COMMENTS = 10;

    /// The best comments shown at the end of a chapter (US-07): visible top-level comments without spoilers,
    /// most upvoted first (oldest first on a tie), at most `limit` (clamped to 1..[#MAX_TOP_COMMENTS]).
    @ReadOnly
    List<ChapterComment> topComments(ChapterId chapterId, int limit);
}
