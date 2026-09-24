package com.readora.infrastructure.persistence.repository;

import com.readora.application.port.out.WorkRepositoryPort.WorkSearch;
import com.readora.infrastructure.persistence.entity.WorkJpaEntity;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.hibernate.query.criteria.HibernateCriteriaBuilder;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/// Catalog search as one SQL query (plus the page count): genre rules are `EXISTS` sub-queries on `work_genres`,
/// and the text matches the ids of a `UNION` of three lookups (title, author, other titles), so nothing is filtered
/// in memory, a series is listed once however many of its titles match, and pagination stays correct. Each lookup
/// can use its trigram index on PostgreSQL (V32); an `OR` of the three, or an `EXISTS` per series, made PostgreSQL
/// scan every series (422 ms to 0.07 ms on 100k series).
public final class WorkSpecifications {

    private static final char LIKE_ESCAPE = '\\';

    private WorkSpecifications() {
    }

    public static Specification<WorkJpaEntity> matching(WorkSearch search) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            String text = search.text();
            if (text != null) {
                String pattern = "%" + escapeLike(text.toLowerCase(Locale.ROOT)) + "%";
                predicates.add(root.get("id").in(((HibernateCriteriaBuilder) cb).union(
                        idsWhereLike(query, cb, "title", pattern),
                        idsWhereLike(query, cb, "author", pattern),
                        idsWithOtherTitleLike(query, cb, pattern))));
            }
            inIfPresent(predicates, root.get("workType"), names(search.types()));
            inIfPresent(predicates, root.get("status"), names(search.statuses()));
            inIfPresent(predicates, root.get("demographic"), names(search.demographics()));
            for (String genre : search.includedGenres()) {
                predicates.add(cb.exists(hasGenre(root, query, cb, genre)));
            }
            for (String genre : search.excludedGenres()) {
                predicates.add(cb.not(cb.exists(hasGenre(root, query, cb, genre))));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    /// `genre` is already lower-cased by the application service.
    private static Subquery<UUID> hasGenre(Root<WorkJpaEntity> root, CriteriaQuery<?> query, CriteriaBuilder cb, String genre) {
        Subquery<UUID> subquery = query.subquery(UUID.class);
        Root<WorkJpaEntity> work = subquery.from(WorkJpaEntity.class);
        Expression<String> workGenre = work.join("genres");
        return subquery.select(work.get("id"))
                .where(cb.equal(work.get("id"), root.get("id")), cb.equal(cb.lower(workGenre), genre));
    }

    /// `pattern` is already lower-cased and escaped.
    private static Subquery<UUID> idsWhereLike(CriteriaQuery<?> query, CriteriaBuilder cb, String column, String pattern) {
        Subquery<UUID> subquery = query.subquery(UUID.class);
        Root<WorkJpaEntity> work = subquery.from(WorkJpaEntity.class);
        return subquery.select(work.get("id")).where(cb.like(cb.lower(work.get(column)), pattern, LIKE_ESCAPE));
    }

    /// `pattern` is already lower-cased and escaped.
    private static Subquery<UUID> idsWithOtherTitleLike(CriteriaQuery<?> query, CriteriaBuilder cb, String pattern) {
        Subquery<UUID> subquery = query.subquery(UUID.class);
        Root<WorkJpaEntity> work = subquery.from(WorkJpaEntity.class);
        Expression<String> otherTitle = work.join("alternativeTitles");
        return subquery.select(work.get("id")).where(cb.like(cb.lower(otherTitle), pattern, LIKE_ESCAPE));
    }

    private static void inIfPresent(List<Predicate> predicates, Expression<String> column, List<String> values) {
        if (!values.isEmpty()) {
            predicates.add(column.in(values));
        }
    }

    private static List<String> names(Collection<? extends Enum<?>> values) {
        return values.stream().map(Enum::name).toList();
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
