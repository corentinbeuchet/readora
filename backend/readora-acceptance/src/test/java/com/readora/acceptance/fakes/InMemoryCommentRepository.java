package com.readora.acceptance.fakes;

import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryCommentRepository implements CommentRepositoryPort {

    private final Map<CommentId, ChapterComment> comments = new ConcurrentHashMap<>();
    private final Map<CommentId, Set<UserId>> upvotes = new ConcurrentHashMap<>();

    @Override
    public Optional<ChapterComment> findById(CommentId id) {
        return Optional.ofNullable(comments.get(id));
    }

    @Override
    public List<ChapterComment> findByChapterId(ChapterId chapterId) {
        return comments.values().stream()
                .filter(c -> c.getChapterId().equals(chapterId) && !c.isHidden())
                .sorted(Comparator.comparing(ChapterComment::getCreatedAt))
                .toList();
    }

    @Override
    public Optional<Instant> findLatestCommentTime(UserId authorId) {
        return comments.values().stream().filter(c -> c.getAuthorId().equals(authorId)).map(ChapterComment::getCreatedAt)
                .max(Comparator.naturalOrder());
    }

    @Override
    public ChapterComment save(ChapterComment comment) {
        comments.put(comment.getId(), comment);
        return comment;
    }

    @Override
    public UpvoteResult addUpvote(CommentId commentId, UserId voterId) {
        boolean counted = upvotes.computeIfAbsent(commentId, id -> ConcurrentHashMap.newKeySet()).add(voterId);
        return new UpvoteResult(counted, upvotes.get(commentId).size());
    }
}
