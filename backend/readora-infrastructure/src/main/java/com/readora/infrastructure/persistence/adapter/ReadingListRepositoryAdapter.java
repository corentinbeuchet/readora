package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.ReadingListRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.list.ListItem;
import com.readora.domain.list.ReadingList;
import com.readora.domain.work.WorkId;
import com.readora.infrastructure.persistence.entity.ReadingListJpaEntity;
import com.readora.infrastructure.persistence.entity.ReadingListUpvoteJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataReadingListRepository;
import com.readora.infrastructure.persistence.repository.SpringDataReadingListUpvoteRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
public class ReadingListRepositoryAdapter implements ReadingListRepositoryPort {

    private final SpringDataReadingListRepository lists;
    private final SpringDataReadingListUpvoteRepository upvotes;

    public ReadingListRepositoryAdapter(SpringDataReadingListRepository lists, SpringDataReadingListUpvoteRepository upvotes) {
        this.lists = lists;
        this.upvotes = upvotes;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ReadingList> findById(UUID id) {
        return lists.findById(id).map(this::toDomain);
    }

    @Override
    @Transactional
    public ReadingList save(ReadingList list) {
        ReadingListJpaEntity row = lists.findById(list.getId())
                .orElseGet(() -> new ReadingListJpaEntity(list.getId(), list.getOwnerId().value(), list.getOwnerUsername(), list.getCreatedAt()));
        row.setTitle(list.getTitle());
        row.setDescription(list.getDescription());
        row.setPublished(list.isPublished());
        row.setUpdatedAt(list.getUpdatedAt());
        row.getItems().clear();
        list.getItems().forEach(item -> row.getItems().add(new ReadingListJpaEntity.Item(item.workId().value(), item.note())));
        return toDomain(lists.saveAndFlush(row));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReadingList> findByOwner(UserId ownerId) {
        return lists.findByOwnerIdOrderByUpdatedAtDesc(ownerId.value()).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReadingList> findTopPublished(int limit) {
        return lists.findTopPublished(PageRequest.of(0, limit)).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional
    public long addUpvote(UUID listId, UserId userId) {
        var key = new ReadingListUpvoteJpaEntity.Key(listId, userId.value());
        if (!upvotes.existsById(key)) {
            // A concurrent duplicate trips the (list_id, user_id) primary key instead of double counting.
            upvotes.saveAndFlush(new ReadingListUpvoteJpaEntity(listId, userId.value(), Instant.now()));
        }
        return upvotes.countByListId(listId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, Long> countUpvotes(Collection<UUID> listIds) {
        Map<UUID, Long> counts = new HashMap<>();
        if (!listIds.isEmpty()) {
            lists.countUpvotes(listIds).forEach(row -> counts.put((UUID) row[0], ((Number) row[1]).longValue()));
        }
        return counts;
    }

    private ReadingList toDomain(ReadingListJpaEntity row) {
        List<ListItem> items = row.getItems().stream().map(item -> new ListItem(WorkId.of(item.getWorkId()), item.getNote())).toList();
        return new ReadingList(row.getId(), UserId.of(row.getOwnerId()), row.getOwnerUsername(), row.getTitle(), row.getDescription(),
                row.isPublished(), items, row.getCreatedAt(), row.getUpdatedAt());
    }
}
