package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.UserAccountJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SpringDataUserAccountRepository extends JpaRepository<UserAccountJpaEntity, String> {
    Optional<UserAccountJpaEntity> findByEmail(String email);
    Optional<UserAccountJpaEntity> findBySubscriptionStripeCustomerId(String stripeCustomerId);
    Optional<UserAccountJpaEntity> findBySubscriptionStripeSubscriptionId(String stripeSubscriptionId);
    boolean existsByEmail(String email);
    boolean existsByUsernameIgnoreCase(String username);
    Optional<UserAccountJpaEntity> findByUsernameIgnoreCase(String username);
}
