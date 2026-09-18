package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.LibraryEntryJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataLibraryEntryRepository extends JpaRepository<LibraryEntryJpaEntity, LibraryEntryJpaEntity.Key> {
    List<LibraryEntryJpaEntity> findByIdUserIdOrderByUpdatedAtDesc(String userId);

    List<LibraryEntryJpaEntity> findByIdUserIdAndStatusOrderByUpdatedAtDesc(String userId, String status);
}
