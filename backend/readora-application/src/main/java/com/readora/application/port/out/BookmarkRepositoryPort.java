package com.readora.application.port.out;

import com.readora.domain.social.Bookmark;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;
import java.util.List;
import java.util.Optional;

public interface BookmarkRepositoryPort {
    Optional<Bookmark> findByUserIdAndWorkId(UserId userId, WorkId workId);
    Bookmark save(Bookmark bookmark);

    default List<Bookmark> findByUserId(UserId userId) {
        return List.of();
    }
}
