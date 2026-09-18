package com.readora.application.port.in;

import com.readora.domain.social.Bookmark;
import com.readora.domain.work.ChapterId;
import com.readora.domain.common.UserId;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Optional;

public interface ManageBookmarkUseCase {
    Bookmark updateProgress(UserId userId, WorkId workId, ChapterId chapterId, int pageIndex);
    Optional<Bookmark> getBookmark(UserId userId, WorkId workId);
    List<Bookmark> listBookmarks(UserId userId);
}
