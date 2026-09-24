package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.ReaderDataErasurePort;
import com.readora.domain.common.UserId;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/// Bulk statements over the tables that hold what only a reader had (US-15). A new table keyed by a reader belongs
/// here too, or it outlives the account.
@Component
public class ReaderDataErasureAdapter implements ReaderDataErasurePort {

    /// `table.column` of every row that is only the reader's. Reading lists go with their items and upvotes (cascade).
    /// Kept on purpose: ratings and reviews (their author shows the placeholder), comment and page reports (moderation
    /// records, still needed after their reporter leaves).
    private static final List<String> READER_ROWS = List.of(
            "comment_upvotes.user_id",
            "library_entries.user_id",
            "chapter_reads.user_id",
            "bookmarks.user_id",
            "notifications.user_id",
            "team_follows.user_id",
            "reading_list_upvotes.user_id",
            "reading_lists.owner_id",
            "review_helpful_votes.voter_id",
            "team_invitations.invitee_id");

    private final EntityManager entityManager;

    public ReaderDataErasureAdapter(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    @Transactional
    public void eraseReaderData(UserId userId) {
        // Comments keep their upvote count in a column: take the reader's upvotes off it before deleting them.
        entityManager.createNativeQuery("UPDATE chapter_comments SET upvotes = upvotes - 1 "
                        + "WHERE id IN (SELECT comment_id FROM comment_upvotes WHERE user_id = :userId)")
                .setParameter("userId", userId.value())
                .executeUpdate();
        for (String row : READER_ROWS) {
            String[] tableAndColumn = row.split("\\.");
            entityManager.createNativeQuery("DELETE FROM " + tableAndColumn[0] + " WHERE " + tableAndColumn[1] + " = :userId")
                    .setParameter("userId", userId.value())
                    .executeUpdate();
        }
    }

    @Override
    @Transactional
    public void renameCommentAuthor(UserId userId, String username) {
        entityManager.createNativeQuery("UPDATE chapter_comments SET author_username = :username WHERE author_id = :userId")
                .setParameter("username", username)
                .setParameter("userId", userId.value())
                .executeUpdate();
    }
}
