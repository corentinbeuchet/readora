package com.readora.acceptance.fakes;

import com.readora.application.port.out.ReaderDataErasurePort;
import com.readora.domain.common.UserId;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/// What `ReaderDataErasureAdapter` touches, in memory: rows that are only a reader's (library, lists…) and the author
/// name shown on each comment.
public class InMemoryReaderData implements ReaderDataErasurePort {

    private final Map<UserId, List<String>> readerRows = new HashMap<>();
    /// Comment text -> [author id, author name].
    private final Map<String, String[]> comments = new HashMap<>();

    public void addReaderRow(UserId userId, String row) {
        readerRows.computeIfAbsent(userId, id -> new ArrayList<>()).add(row);
    }

    public void addComment(UserId author, String authorName, String text) {
        comments.put(text, new String[]{author.value(), authorName});
    }

    public List<String> readerRowsOf(UserId userId) {
        return List.copyOf(readerRows.getOrDefault(userId, List.of()));
    }

    /// The name shown on the comment with this text.
    public String authorOf(String text) {
        return comments.get(text)[1];
    }

    @Override
    public void eraseReaderData(UserId userId) {
        readerRows.remove(userId);
    }

    @Override
    public void renameCommentAuthor(UserId userId, String username) {
        comments.values().stream().filter(comment -> comment[0].equals(userId.value())).forEach(comment -> comment[1] = username);
    }
}
