package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chapter_comments")
public class ChapterCommentJpaEntity {

    @Id
    private UUID id;

    @Column(name = "chapter_id", nullable = false)
    private UUID chapterId;

    @Column(name = "author_id", nullable = false)
    private String authorId;

    @Column(name = "author_username", nullable = false)
    private String authorUsername;

    @Column(nullable = false, length = 2000)
    private String content;

    @Column(name = "page_reference")
    private Integer pageReference;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(nullable = false)
    private int depth;

    @Column(name = "is_spoiler", nullable = false)
    private boolean isSpoiler;

    @Column(nullable = false)
    private int upvotes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public ChapterCommentJpaEntity() {}

    public ChapterCommentJpaEntity(UUID id, UUID chapterId, String authorId, String authorUsername, String content, Integer pageReference, UUID parentId, int depth, boolean isSpoiler, int upvotes, Instant createdAt) {
        this.id = id;
        this.chapterId = chapterId;
        this.authorId = authorId;
        this.authorUsername = authorUsername;
        this.content = content;
        this.pageReference = pageReference;
        this.parentId = parentId;
        this.depth = depth;
        this.isSpoiler = isSpoiler;
        this.upvotes = upvotes;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getChapterId() { return chapterId; }
    public String getAuthorId() { return authorId; }
    public String getAuthorUsername() { return authorUsername; }
    public String getContent() { return content; }
    public Integer getPageReference() { return pageReference; }
    public UUID getParentId() { return parentId; }
    public int getDepth() { return depth; }
    public boolean isSpoiler() { return isSpoiler; }
    public int getUpvotes() { return upvotes; }
    public Instant getCreatedAt() { return createdAt; }
}
