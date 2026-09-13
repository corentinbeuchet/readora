package com.readora.application.service;

import com.readora.application.port.in.ManageBookmarkUseCase;
import com.readora.application.port.out.BookmarkRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.identity.Permission;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.social.Bookmark;
import com.readora.domain.social.ReadingProgressUpdatedEvent;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class BookmarkService implements ManageBookmarkUseCase {
    private final BookmarkRepositoryPort bookmarkRepository;
    private final UserAccountRepositoryPort userRepository;
    private final EventPublisherPort eventPublisher;

    public BookmarkService(BookmarkRepositoryPort bookmarkRepository, UserAccountRepositoryPort userRepository, EventPublisherPort eventPublisher) {
        this.bookmarkRepository = Objects.requireNonNull(bookmarkRepository, "BookmarkRepositoryPort cannot be null");
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public Bookmark updateProgress(UserId userId, WorkId workId, ChapterId chapterId, int pageIndex) {
        requirePermission(userId, Permission.BOOKMARK_WRITE);

        Bookmark bookmark = bookmarkRepository.findByUserIdAndWorkId(userId, workId)
                .orElseGet(() -> Bookmark.startReading(userId, workId, chapterId, pageIndex));
        bookmark.updateProgress(chapterId, pageIndex);
        Bookmark saved = bookmarkRepository.save(bookmark);

        eventPublisher.publish(ReadingProgressUpdatedEvent.now(userId, workId, chapterId, pageIndex));
        return saved;
    }

    @Override
    public Optional<Bookmark> getBookmark(UserId userId, WorkId workId) {
        requirePermission(userId, Permission.BOOKMARK_READ);
        return bookmarkRepository.findByUserIdAndWorkId(userId, workId);
    }

    @Override
    public List<Bookmark> listBookmarks(UserId userId) {
        requirePermission(userId, Permission.BOOKMARK_READ);
        return bookmarkRepository.findByUserId(userId);
    }

    private void requirePermission(UserId userId, Permission permission) {
        UserAccount account = userRepository.findById(userId)
                .orElseThrow(() -> new AccessDeniedDomainException("Unknown user: " + userId));
        if (!account.can(permission)) {
            throw new AccessDeniedDomainException("Permission " + permission + " required. Upgrade to PREMIUM to use bookmarks.");
        }
    }
}
