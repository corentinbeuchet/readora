package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.ReadingListJpaEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataReadingListRepository extends JpaRepository<ReadingListJpaEntity, UUID> {

    List<ReadingListJpaEntity> findByOwnerIdOrderByUpdatedAtDesc(String ownerId);

    @Query("""
            select l from ReadingListJpaEntity l where l.published = true
            order by (select count(v) from ReadingListUpvoteJpaEntity v where v.id.listId = l.id) desc, l.updatedAt desc
            """)
    List<ReadingListJpaEntity> findTopPublished(Pageable page);

    @Query("select v.id.listId, count(v) from ReadingListUpvoteJpaEntity v where v.id.listId in :ids group by v.id.listId")
    List<Object[]> countUpvotes(@Param("ids") Collection<UUID> ids);
}
