package com.readora.web.dto;

import com.readora.application.port.in.ManageListsUseCase.ListView;
import com.readora.domain.work.Work;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/// A list with its series in the owner's order (series deleted since are left out).
public record ReadingListDto(UUID id, String title, String description, boolean published, String ownerUsername, String ownerId,
                             long upvotes, List<Entry> items, Instant updatedAt) {

    public record Entry(WorkSummaryDto work, @Nullable String note) {
    }

    public static ReadingListDto fromDomain(ListView view) {
        Map<UUID, Work> works = view.works().stream().collect(Collectors.toMap(w -> w.getId().value(), Function.identity()));
        var list = view.list();
        List<Entry> entries = list.getItems().stream()
                .flatMap(item -> Optional.ofNullable(works.get(item.workId().value()))
                        .map(work -> new Entry(WorkSummaryDto.fromDomain(work), item.note())).stream())
                .toList();
        return new ReadingListDto(list.getId(), list.getTitle(), list.getDescription(), list.isPublished(), list.getOwnerUsername(),
                list.getOwnerId().value(), view.upvotes(), entries, list.getUpdatedAt());
    }
}
