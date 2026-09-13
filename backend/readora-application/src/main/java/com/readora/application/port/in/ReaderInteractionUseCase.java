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
    void upvoteComment(CommentId commentId);
    List<ChapterComment> getCommentsForChapter(ChapterId chapterId);
    Bookmark updateReadingProgress(UserId userId, WorkId workId, ChapterId chapterId, int pageIndex);
}
