package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.LibraryEntryJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataLibraryEntryRepository extends JpaRepository<LibraryEntryJpaEntity, LibraryEntryJpaEntity.Key> {
    List<LibraryEntryJpaEntity> findByIdUserIdOrderByUpdatedAtDesc(String userId);

    List<LibraryEntryJpaEntity> findByIdUserIdAndStatusOrderByUpdatedAtDesc(String userId, String status);

    @Query("select l.id.userId from LibraryEntryJpaEntity l where l.id.workId = :workId and l.notify = true")
    List<String> findSubscriberIds(@Param("workId") UUID workId);
}
