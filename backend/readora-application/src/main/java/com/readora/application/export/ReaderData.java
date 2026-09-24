package com.readora.application.export;

import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;

/// Everything Readora keeps about a reader besides the account itself (US-15, GDPR data portability), oldest first.
public record ReaderData(List<LibraryItem> library, List<ChapterRead> readingHistory, List<Bookmark> bookmarks,
                         List<ReadingList> readingLists, List<Comment> comments, List<Rating> ratings,
                         List<TeamMembership> teams, List<TeamFollow> followedTeams) {

    public ReaderData {
        library = List.copyOf(library);
        readingHistory = List.copyOf(readingHistory);
        bookmarks = List.copyOf(bookmarks);
        readingLists = List.copyOf(readingLists);
        comments = List.copyOf(comments);
        ratings = List.copyOf(ratings);
        teams = List.copyOf(teams);
        followedTeams = List.copyOf(followedTeams);
    }

    public record LibraryItem(String series, String status, Instant addedAt, Instant updatedAt) {
    }

    public record ChapterRead(String series, String chapterNumber, Instant readAt, boolean finished) {
    }

    /// @param chapterNumber `null` when the chapter was removed since
    public record Bookmark(String series, @Nullable String chapterNumber, int page, Instant updatedAt) {
    }

    public record ReadingList(String title, String description, boolean published, Instant createdAt, List<ListItem> items) {
        public ReadingList {
            items = List.copyOf(items);
        }
    }

    public record ListItem(String series, @Nullable String note) {
    }

    /// @param hidden a moderator hid it (readers don't see it any more)
    public record Comment(String series, String chapterNumber, String content, boolean spoiler, boolean hidden, Instant createdAt) {
    }

    public record Rating(String series, int score, @Nullable String liked, @Nullable String disliked, @Nullable String verdict,
                         Instant ratedAt) {
    }

    public record TeamMembership(String team, List<String> roles, Instant joinedAt) {
        public TeamMembership {
            roles = List.copyOf(roles);
        }
    }

    public record TeamFollow(String team, Instant followedAt) {
    }
}
