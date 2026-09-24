package com.readora.application.port.out;

import com.readora.domain.common.UserId;

/// What only a reader had, erased with the account (US-15), in a few bulk statements rather than one port per table.
public interface ReaderDataErasurePort {

    /// Deletes the library, reading history, bookmarks, reading lists (with their items and upvotes), notifications,
    /// team follows, comment upvotes (their counts go down), helpful votes and the invitations sent to the reader.
    void eraseReaderData(UserId userId);

    /// Comments keep their text and replies; the name shown on them becomes `username`.
    void renameCommentAuthor(UserId userId, String username);
}
