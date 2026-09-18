package com.readora.application.port.in;

import com.readora.domain.social.Bookmark;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;

import java.util.List;

public interface ReaderInteractionUseCase {
    ChapterComment postRootComment(ChapterId chapterId, UserId authorId, String username, String text, Integer pageRef, boolean isSpoiler);
    ChapterComment replyToComment(CommentId parentCommentId, UserId authorId, String username, String text, boolean isSpoiler);
    /// One upvote per user per comment; repeating it is a no-op. Authors can't upvote their own comments.
    ///
    /// @return the comment's upvote total and whether this call counted
    UpvoteOutcome upvoteComment(CommentId commentId, UserId voterId);

    record UpvoteOutcome(CommentId commentId, int upvotes, boolean counted) {}
    List<ChapterComment> getCommentsForChapter(ChapterId chapterId);
    Bookmark updateReadingProgress(UserId userId, WorkId workId, ChapterId chapterId, int pageIndex);
}
