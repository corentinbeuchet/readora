package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.UserAccountJpaEntity;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataUserAccountRepository extends JpaRepository<UserAccountJpaEntity, String> {
    @Override
    Optional<UserAccountJpaEntity> findById(String id);

    Optional<UserAccountJpaEntity> findByEmail(String email);

    boolean existsByEmail(String email);
    boolean existsByUsernameIgnoreCase(String username);

    Optional<UserAccountJpaEntity> findByUsernameIgnoreCase(String username);

    /// `pattern` is an escaped `LIKE` prefix (lower case).
    @Query("select u from UserAccountJpaEntity u where u.deletedAt is null "
            + "and (lower(u.username) like :pattern escape '\\' or lower(u.email) like :pattern escape '\\') order by u.username")
    List<UserAccountJpaEntity> searchByUsernameOrEmail(@Param("pattern") String pattern, Limit limit);
}
