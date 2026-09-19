package com.readora.acceptance.fakes;

import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/// In-memory [WorkRepositoryPort] with the same search semantics as the JPA adapter (`WorkSpecifications`).
public class InMemoryWorkRepository implements WorkRepositoryPort {

    private final Map<WorkId, Work> works;

    public InMemoryWorkRepository() {
        this(new ConcurrentHashMap<>());
    }

    /// Backed by a map the caller also uses (steps that store works directly).
    public InMemoryWorkRepository(Map<WorkId, Work> works) {
        this.works = works;
    }

    @Override
    public Optional<Work> findById(WorkId id) {
        return Optional.ofNullable(works.get(id));
    }

    @Override
    public Work save(Work work) {
        works.put(work.getId(), work);
        return work;
    }

    @Override
    public List<Work> findAllById(Collection<WorkId> ids) {
        return ids.stream().map(works::get).filter(Objects::nonNull).toList();
    }

    public Work byTitle(String title) {
        return works.values().stream().filter(w -> w.getTitle().equals(title)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No work titled " + title));
    }

    @Override
    public WorkPage search(WorkSearch search, int page, int size) {
        List<Work> matching = works.values().stream()
                .filter(work -> matches(work, search))
                .sorted(Comparator.comparing(Work::getUpdatedAt).reversed())
                .toList();
        return new WorkPage(matching.stream().skip((long) page * size).limit(size).toList(), matching.size());
    }

    @Override
    public Optional<Work> findRandom(WorkSearch search) {
        List<Work> matching = works.values().stream().filter(work -> matches(work, search)).toList();
        return matching.isEmpty() ? Optional.empty()
                : Optional.of(matching.get(java.util.concurrent.ThreadLocalRandom.current().nextInt(matching.size())));
    }

    @Override
    public List<String> findAllGenres() {
        return works.values().stream().flatMap(work -> work.getGenres().stream()).distinct().sorted().toList();
    }

    public Collection<Work> all() {
        return works.values();
    }

    private static boolean matches(Work work, WorkSearch search) {
        Set<String> genres = work.getGenres().stream().map(g -> g.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        String text = search.text();
        boolean textMatches = text == null
                || contains(work.getTitle(), text)
                || (work.getAuthor() != null && contains(work.getAuthor(), text));
        return textMatches
                && genres.containsAll(search.includedGenres())
                && search.excludedGenres().stream().noneMatch(genres::contains)
                && (search.types().isEmpty() || search.types().contains(work.getType()))
                && (search.statuses().isEmpty() || search.statuses().contains(work.getStatus()))
                && (search.demographics().isEmpty() || search.demographics().contains(work.getDemographic()));
    }

    private static boolean contains(String value, String part) {
        return value.toLowerCase(Locale.ROOT).contains(part.toLowerCase(Locale.ROOT));
    }
}
