package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.UserAccountJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SpringDataUserAccountRepository extends JpaRepository<UserAccountJpaEntity, String> {
    @Override
    Optional<UserAccountJpaEntity> findById(String id);

    Optional<UserAccountJpaEntity> findByEmail(String email);

    boolean existsByEmail(String email);
    boolean existsByUsernameIgnoreCase(String username);

    Optional<UserAccountJpaEntity> findByUsernameIgnoreCase(String username);
}
