package com.readora.acceptance.fakes;

import com.readora.application.export.ReaderData;
import com.readora.application.port.out.ReaderDataExportPort;
import com.readora.domain.common.UserId;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/// What `ReaderDataExportAdapter` reads, in memory: the library, comments and ratings a scenario gives a reader.
public class InMemoryReaderExport implements ReaderDataExportPort {

    private final Map<UserId, List<ReaderData.LibraryItem>> library = new HashMap<>();
    private final Map<UserId, List<ReaderData.Comment>> comments = new HashMap<>();
    private final Map<UserId, List<ReaderData.Rating>> ratings = new HashMap<>();

    public void keep(UserId reader, String series, Instant at) {
        library.computeIfAbsent(reader, id -> new ArrayList<>()).add(new ReaderData.LibraryItem(series, "READING", at, at));
    }

    public void comment(UserId reader, String series, String content, Instant at) {
        comments.computeIfAbsent(reader, id -> new ArrayList<>()).add(new ReaderData.Comment(series, "1", content, false, false, at));
    }

    public void rate(UserId reader, String series, int score, Instant at) {
        ratings.computeIfAbsent(reader, id -> new ArrayList<>()).add(new ReaderData.Rating(series, score, null, null, null, at));
    }

    @Override
    public ReaderData dataOf(UserId userId) {
        return new ReaderData(library.getOrDefault(userId, List.of()), List.of(), List.of(), List.of(), comments.getOrDefault(userId, List.of()),
                ratings.getOrDefault(userId, List.of()), List.of(), List.of());
    }
}
