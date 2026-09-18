package com.readora.acceptance.steps;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.service.ReaderSocialService;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.ChapterStatus;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;

public class SocialCommentsStepDefinitions {

    private final Map<CommentId, ChapterComment> commentStore = new ConcurrentHashMap<>();
    private final Map<String, CommentId> aliasToCommentId = new ConcurrentHashMap<>();
    private final Set<String> upvotes = ConcurrentHashMap.newKeySet();

    private ReaderSocialService readerSocialService;
    private ChapterId currentChapterId;
    private ChapterComment lastPostedComment;

    @Before
    public void setup() {
        commentStore.clear();
        aliasToCommentId.clear();
        upvotes.clear();
        currentChapterId = ChapterId.generate();

        CommentRepositoryPort commentRepo = new CommentRepositoryPort() {
            @Override
            public Optional<ChapterComment> findById(CommentId id) {
                return Optional.ofNullable(commentStore.get(id));
            }

            @Override
            public List<ChapterComment> findByChapterId(ChapterId chapterId) {
                return commentStore.values().stream().filter(c -> c.getChapterId().equals(chapterId)).toList();
            }

            @Override
            public ChapterComment save(ChapterComment comment) {
                commentStore.put(comment.getId(), comment);
                return comment;
            }

            @Override
            public UpvoteResult addUpvote(CommentId commentId, UserId voterId) {
                ChapterComment c = commentStore.get(commentId);
                boolean counted = upvotes.add(commentId + ":" + voterId);
                int total = c.getUpvotes() + (counted ? 1 : 0);
                commentStore.put(commentId, new ChapterComment(c.getId(), c.getChapterId(), c.getAuthorId(), c.getAuthorUsername(),
                        c.getContent(), c.getPageReference(), c.getParentId(), c.getDepth(), c.isSpoiler(), total, c.getCreatedAt()));
                return new UpvoteResult(counted, total);
            }
        };

        // Every chapter the scenarios comment on is published.
        ChapterRepositoryPort chapterRepo = new ChapterRepositoryPort() {
            @Override
            public Optional<Chapter> findById(ChapterId id) {
                return Optional.of(new Chapter(id, WorkId.generate(), ChapterNumber.of("1"), "Chapter 1", ChapterStatus.PUBLISHED,
                        List.of(PageAsset.create(1, "p1.webp", null)), null, null, null, null));
            }

            @Override
            public List<Chapter> findByWorkId(WorkId workId) {
                return List.of();
            }

            @Override
            public Chapter save(Chapter chapter) {
                return chapter;
            }
        };

        EventPublisherPort eventPublisher = event -> {
        };

        readerSocialService = new ReaderSocialService(commentRepo, chapterRepo, eventPublisher);
    }

    @Given("a published chapter {string} of {string} exists")
    public void publishedChapterExists(String chapterTitle, String workTitle) {
        // Chapter initialized
    }

    @Given("reader {string} and reader {string} are authenticated")
    public void readersAuthenticated(String r1, String r2) {
        // Authentication context
    }

    @When("{string} posts a comment {string} on {string} with page reference {int} and spoiler flag {word}")
    public void readerPostsComment(String readerName, String text, String chapterName, int pageRef, String spoilerFlagStr) {
        boolean isSpoiler = Boolean.parseBoolean(spoilerFlagStr);
        lastPostedComment = readerSocialService.postRootComment(currentChapterId, UserId.of(readerName), readerName, text, pageRef, isSpoiler);
    }

    @Then("the comment should be recorded with spoiler status enabled")
    public void verifySpoilerEnabled() {
        assertThat(lastPostedComment.isSpoiler()).isTrue();
    }

    @Then("the comment should link to page {int} of {string}")
    public void verifyPageReference(int expectedPageRef, String chapterName) {
        assertThat(lastPostedComment.getPageReference()).isEqualTo(expectedPageRef);
    }

    @Given("{string} has posted comment {string} on {string}")
    public void readerHasPostedCommentWithAlias(String readerName, String alias, String chapterName) {
        ChapterComment root = readerSocialService.postRootComment(currentChapterId, UserId.of(readerName), readerName, "Sample root comment " + alias, null, false);
        aliasToCommentId.put(alias, root.getId());
    }

    @When("{string} posts a reply {string} to comment {string}")
    public void readerRepliesToComment(String readerName, String replyText, String parentAlias) {
        CommentId parentId = aliasToCommentId.get(parentAlias);
        lastPostedComment = readerSocialService.replyToComment(parentId, UserId.of(readerName), readerName, replyText, false);
    }

    @Then("the new comment should have parent id {string}")
    public void verifyParentId(String parentAlias) {
        CommentId expectedParentId = aliasToCommentId.get(parentAlias);
        assertThat(lastPostedComment.getParentId()).isEqualTo(expectedParentId);
    }

    @Then("the comment thread depth should be within the maximum allowed limit of {int}")
    public void verifyThreadDepth(int maxDepth) {
        assertThat(lastPostedComment.getDepth()).isLessThanOrEqualTo(maxDepth);
    }

    @Given("{string} has posted comment {string} on {string} with {int} upvotes")
    public void readerHasPostedCommentWithUpvotes(String readerName, String alias, String chapterName, int upvotes) {
        ChapterComment root = readerSocialService.postRootComment(currentChapterId, UserId.of(readerName), readerName, "Upvote test comment", null, false);
        aliasToCommentId.put(alias, root.getId());
    }

    @When("{string} upvotes comment {string}")
    public void readerUpvotesComment(String readerName, String alias) {
        CommentId commentId = aliasToCommentId.get(alias);
        readerSocialService.upvoteComment(commentId, UserId.of(readerName));
    }

    @Then("the comment {string} upvote count should be {int}")
    public void verifyUpvoteCount(String alias, int expectedCount) {
        CommentId commentId = aliasToCommentId.get(alias);
        ChapterComment comment = readerSocialService.getCommentsForChapter(currentChapterId).stream()
                .filter(c -> c.getId().equals(commentId))
                .findFirst()
                .orElseThrow();
        assertThat(comment.getUpvotes()).isEqualTo(expectedCount);
    }
}
