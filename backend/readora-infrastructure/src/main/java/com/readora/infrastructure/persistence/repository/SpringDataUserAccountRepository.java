package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.UserAccountJpaEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/// The subscription is part of the account aggregate, so every finder joins it (`@EntityGraph`): one statement per
/// lookup instead of a second select for the subscription.
@Repository
public interface SpringDataUserAccountRepository extends JpaRepository<UserAccountJpaEntity, String> {
    @Override
    @EntityGraph(attributePaths = "subscription")
    Optional<UserAccountJpaEntity> findById(String id);

    @EntityGraph(attributePaths = "subscription")
    Optional<UserAccountJpaEntity> findByEmail(String email);

    @EntityGraph(attributePaths = "subscription")
    Optional<UserAccountJpaEntity> findBySubscriptionStripeCustomerId(String stripeCustomerId);

    @EntityGraph(attributePaths = "subscription")
    Optional<UserAccountJpaEntity> findBySubscriptionStripeSubscriptionId(String stripeSubscriptionId);

    boolean existsByEmail(String email);
    boolean existsByUsernameIgnoreCase(String username);

    @EntityGraph(attributePaths = "subscription")
    Optional<UserAccountJpaEntity> findByUsernameIgnoreCase(String username);
}
