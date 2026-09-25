package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.WorkJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataWorkRepository extends JpaRepository<WorkJpaEntity, UUID>, JpaSpecificationExecutor<WorkJpaEntity> {

    @Query("select distinct g from WorkJpaEntity w join w.genres g order by g")
    List<String> findAllGenres();

    /// Rows of `[id, title]`: no genre or other title is loaded.
    @Query("select w.id, w.title from WorkJpaEntity w where w.id in :ids")
    List<Object[]> findTitlesByIds(@Param("ids") Collection<UUID> ids);
}
