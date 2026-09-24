package com.readora.infrastructure.persistence.adapter;

import com.readora.application.export.ReaderData;
import com.readora.application.port.out.ReaderDataExportPort;
import com.readora.domain.common.UserId;
import jakarta.persistence.EntityManager;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/// Reads what a reader has for the account export (US-15): one query per kind, series and teams named, oldest first.
@Component
public class ReaderDataExportAdapter implements ReaderDataExportPort {

    private final EntityManager entityManager;

    public ReaderDataExportAdapter(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    @Transactional(readOnly = true)
    public ReaderData dataOf(UserId userId) {
        return new ReaderData(
                rows(userId, """
                        SELECT w.title, l.status, l.added_at, l.updated_at FROM library_entries l JOIN works w ON w.id = l.work_id
                        WHERE l.user_id = :userId ORDER BY l.added_at""",
                        r -> new ReaderData.LibraryItem(text(r[0]), text(r[1]), instant(r[2]), instant(r[3]))),
                rows(userId, """
                        SELECT w.title, r.chapter_number, r.read_at, r.finished FROM chapter_reads r JOIN works w ON w.id = r.work_id
                        WHERE r.user_id = :userId ORDER BY r.read_at""",
                        r -> new ReaderData.ChapterRead(text(r[0]), text(r[1]), instant(r[2]), bool(r[3]))),
                rows(userId, """
                        SELECT w.title, c.chapter_number, b.last_read_page_index, b.updated_at FROM bookmarks b
                        JOIN works w ON w.id = b.work_id LEFT JOIN chapters c ON c.id = b.last_read_chapter_id
                        WHERE b.user_id = :userId ORDER BY b.updated_at""",
                        r -> new ReaderData.Bookmark(text(r[0]), optionalText(r[1]), number(r[2]), instant(r[3]))),
                readingLists(userId),
                rows(userId, """
                        SELECT w.title, ch.chapter_number, c.content, c.is_spoiler, c.hidden, c.created_at FROM chapter_comments c
                        JOIN chapters ch ON ch.id = c.chapter_id JOIN works w ON w.id = ch.work_id
                        WHERE c.author_id = :userId ORDER BY c.created_at""",
                        r -> new ReaderData.Comment(text(r[0]), text(r[1]), text(r[2]), bool(r[3]), bool(r[4]), instant(r[5]))),
                rows(userId, """
                        SELECT w.title, r.score, r.liked, r.disliked, r.verdict, r.rated_at FROM work_ratings r JOIN works w ON w.id = r.work_id
                        WHERE r.user_id = :userId ORDER BY r.rated_at""",
                        r -> new ReaderData.Rating(text(r[0]), number(r[1]), optionalText(r[2]), optionalText(r[3]), optionalText(r[4]),
                                instant(r[5]))),
                memberships(userId),
                rows(userId, """
                        SELECT t.name, f.followed_at FROM team_follows f JOIN teams t ON t.id = f.team_id
                        WHERE f.user_id = :userId ORDER BY f.followed_at""",
                        r -> new ReaderData.TeamFollow(text(r[0]), instant(r[1]))));
    }

    private List<ReaderData.ReadingList> readingLists(UserId userId) {
        Map<Object, ReaderData.ReadingList> lists = new LinkedHashMap<>();
        Map<Object, List<ReaderData.ListItem>> items = new LinkedHashMap<>();
        for (Object[] r : query(userId, """
                SELECT l.id, l.title, l.description, l.published, l.created_at, w.title, i.note FROM reading_lists l
                LEFT JOIN reading_list_items i ON i.list_id = l.id LEFT JOIN works w ON w.id = i.work_id
                WHERE l.owner_id = :userId ORDER BY l.created_at, i.position""")) {
            lists.putIfAbsent(r[0], new ReaderData.ReadingList(text(r[1]), text(r[2]), bool(r[3]), instant(r[4]), List.of()));
            List<ReaderData.ListItem> listItems = items.computeIfAbsent(r[0], id -> new java.util.ArrayList<>());
            if (r[5] != null) {
                listItems.add(new ReaderData.ListItem(text(r[5]), optionalText(r[6])));
            }
        }
        return lists.entrySet().stream()
                .map(entry -> new ReaderData.ReadingList(entry.getValue().title(), entry.getValue().description(), entry.getValue().published(),
                        entry.getValue().createdAt(), items.getOrDefault(entry.getKey(), List.of())))
                .toList();
    }

    private List<ReaderData.TeamMembership> memberships(UserId userId) {
        Map<Object, Object[]> teams = new LinkedHashMap<>();
        Map<Object, List<String>> roles = new LinkedHashMap<>();
        for (Object[] r : query(userId, """
                SELECT m.id, t.name, m.joined_at, mr.role FROM team_members m JOIN teams t ON t.id = m.team_id
                LEFT JOIN member_roles mr ON mr.member_id = m.id WHERE m.user_id = :userId ORDER BY m.joined_at, mr.role""")) {
            teams.putIfAbsent(r[0], r);
            List<String> memberRoles = roles.computeIfAbsent(r[0], id -> new java.util.ArrayList<>());
            if (r[3] != null) {
                memberRoles.add(text(r[3]));
            }
        }
        return teams.entrySet().stream()
                .map(entry -> new ReaderData.TeamMembership(text(entry.getValue()[1]), roles.getOrDefault(entry.getKey(), List.of()),
                        instant(entry.getValue()[2])))
                .toList();
    }

    private <T> List<T> rows(UserId userId, String sql, Function<Object[], T> mapper) {
        return query(userId, sql).stream().map(mapper).toList();
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> query(UserId userId, String sql) {
        return ((List<Object>) entityManager.createNativeQuery(sql).setParameter("userId", userId.value()).getResultList()).stream()
                .map(row -> row instanceof Object[] columns ? columns : new Object[]{row})
                .toList();
    }

    private static String text(@Nullable Object value) {
        return value == null ? "" : value.toString();
    }

    private static @Nullable String optionalText(@Nullable Object value) {
        return value == null ? null : value.toString();
    }

    private static boolean bool(@Nullable Object value) {
        return value instanceof Boolean flag ? flag : value instanceof Number n && n.intValue() != 0;
    }

    private static int number(@Nullable Object value) {
        return value instanceof Number n ? n.intValue() : 0;
    }

    /// Native timestamps arrive as the driver's type (JDBC `Timestamp`, `OffsetDateTime`…) depending on the database.
    private static Instant instant(@Nullable Object value) {
        return switch (value) {
            case Instant instant -> instant;
            case OffsetDateTime offset -> offset.toInstant();
            case ZonedDateTime zoned -> zoned.toInstant();
            case Timestamp timestamp -> timestamp.toInstant();
            case null, default -> throw new IllegalStateException("Not a timestamp: " + Arrays.toString(new Object[]{value}));
        };
    }
}
