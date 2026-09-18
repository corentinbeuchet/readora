package com.readora.application.port.out;

import com.readora.domain.work.Demographic;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface WorkRepositoryPort {
    Optional<Work> findById(WorkId id);
    Work save(Work work);

    /// Criteria are combined with AND; empty sets and a `null` text don't filter.
    /// Genres arrive lower-cased and match case-insensitively: every `includedGenres` entry must be present,
    /// no `excludedGenres` entry may be. `text` matches part of the title or author, case-insensitively.
    record WorkSearch(@Nullable String text, Set<String> includedGenres, Set<String> excludedGenres,
                      Set<WorkType> types, Set<WorkStatus> statuses, Set<Demographic> demographics) {
        public WorkSearch {
            includedGenres = Set.copyOf(includedGenres);
            excludedGenres = Set.copyOf(excludedGenres);
            types = Set.copyOf(types);
            statuses = Set.copyOf(statuses);
            demographics = Set.copyOf(demographics);
        }
    }

    record WorkPage(List<Work> items, long totalElements) {
        public WorkPage {
            items = List.copyOf(items);
        }
    }

    /// Matching works, most recently updated first.
    WorkPage search(WorkSearch search, int page, int size);

    /// Every genre used by at least one work, sorted alphabetically.
    List<String> findAllGenres();
}
