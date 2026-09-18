package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.Subscription;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.identity.SubscriptionStatus;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.work.UserId;
import com.readora.infrastructure.persistence.entity.SubscriptionJpaEntity;
import com.readora.infrastructure.persistence.entity.UserAccountJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataUserAccountRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class UserAccountRepositoryAdapter implements UserAccountRepositoryPort {

    private static final String ROLE_SEPARATOR = ",";

    private final SpringDataUserAccountRepository springDataRepository;

    public UserAccountRepositoryAdapter(SpringDataUserAccountRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Optional<UserAccount> findById(UserId id) {
        return springDataRepository.findById(id.value()).map(this::toDomain);
    }

    @Override
    public Optional<UserAccount> findByEmail(Email email) {
        return springDataRepository.findByEmail(email.value()).map(this::toDomain);
    }

    @Override
    public Optional<UserAccount> findByUsername(String username) {
        return springDataRepository.findByUsernameIgnoreCase(username).map(this::toDomain);
    }

    @Override
    public Optional<UserAccount> findByExternalCustomerId(String externalCustomerId) {
        return springDataRepository.findBySubscriptionStripeCustomerId(externalCustomerId).map(this::toDomain);
    }

    @Override
    public Optional<UserAccount> findByExternalSubscriptionId(String externalSubscriptionId) {
        return springDataRepository.findBySubscriptionStripeSubscriptionId(externalSubscriptionId).map(this::toDomain);
    }

    @Override
    public boolean existsByEmail(Email email) {
        return springDataRepository.existsByEmail(email.value());
    }

    @Override
    public boolean existsByUsername(String username) {
        return springDataRepository.existsByUsernameIgnoreCase(username);
    }

    @Override
    @Transactional
    public UserAccount save(UserAccount account) {
        UserAccountJpaEntity entity = springDataRepository.findById(account.getId().value())
                .map(existing -> {
                    OptimisticLocking.verify(account, existing.getVersion(), "UserAccount");
                    return updateEntity(existing, account);
                })
                .orElseGet(() -> toEntity(account));
        UserAccountJpaEntity saved = springDataRepository.saveAndFlush(entity);
        account.restoreVersion(saved.getVersion());
        return toDomain(saved);
    }

    private UserAccount toDomain(UserAccountJpaEntity entity) {
        return OptimisticLocking.restored(toDomainState(entity), entity.getVersion());
    }

    private UserAccount toDomainState(UserAccountJpaEntity entity) {
        return new UserAccount(
                UserId.of(entity.getId()),
                Email.of(entity.getEmail()),
                entity.getUsername(),
                PasswordHash.of(entity.getPasswordHash()),
                entity.getDisplayName(),
                entity.getBio(),
                entity.getAvatarUrl(),
                parseRoles(entity.getRoles()),
                toDomainSubscription(entity.getSubscription()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private Subscription toDomainSubscription(SubscriptionJpaEntity entity) {
        if (entity == null) {
            return Subscription.free();
        }
        return new Subscription(
                SubscriptionPlan.valueOf(entity.getPlan()),
                SubscriptionStatus.valueOf(entity.getStatus()),
                entity.getCurrentPeriodEnd(),
                entity.getStripeCustomerId(),
                entity.getStripeSubscriptionId(),
                entity.getLastEventId(),
                entity.getUpdatedAt()
        );
    }

    private UserAccountJpaEntity toEntity(UserAccount account) {
        UserAccountJpaEntity entity = new UserAccountJpaEntity(
                account.getId().value(),
                account.getEmail().value(),
                account.getUsername(),
                account.getPasswordHash().value(),
                account.getDisplayName(),
                account.getBio(),
                account.getAvatarUrl(),
                joinRoles(account.getRoles()),
                account.getCreatedAt(),
                account.getUpdatedAt()
        );
        entity.setSubscription(toSubscriptionEntity(account.getSubscription()));
        return entity;
    }

    private UserAccountJpaEntity updateEntity(UserAccountJpaEntity entity, UserAccount account) {
        entity.setEmail(account.getEmail().value());
        entity.setUsername(account.getUsername());
        entity.setPasswordHash(account.getPasswordHash().value());
        entity.setDisplayName(account.getDisplayName());
        entity.setBio(account.getBio());
        entity.setAvatarUrl(account.getAvatarUrl());
        entity.setRoles(joinRoles(account.getRoles()));
        entity.setUpdatedAt(account.getUpdatedAt());

        Subscription subscription = account.getSubscription();
        SubscriptionJpaEntity subEntity = entity.getSubscription();
        if (subEntity == null) {
            entity.setSubscription(toSubscriptionEntity(subscription));
        } else {
            subEntity.setPlan(subscription.getPlan().name());
            subEntity.setStatus(subscription.getStatus().name());
            subEntity.setCurrentPeriodEnd(subscription.getCurrentPeriodEnd());
            subEntity.setStripeCustomerId(subscription.getExternalCustomerId());
            subEntity.setStripeSubscriptionId(subscription.getExternalSubscriptionId());
            subEntity.setLastEventId(subscription.getLastEventId());
            subEntity.setUpdatedAt(subscription.getUpdatedAt());
        }
        return entity;
    }

    private SubscriptionJpaEntity toSubscriptionEntity(Subscription subscription) {
        return new SubscriptionJpaEntity(
                subscription.getPlan().name(),
                subscription.getStatus().name(),
                subscription.getCurrentPeriodEnd(),
                subscription.getExternalCustomerId(),
                subscription.getExternalSubscriptionId(),
                subscription.getLastEventId(),
                subscription.getUpdatedAt()
        );
    }

    private static String joinRoles(Set<Role> roles) {
        return roles.stream().map(Enum::name).sorted().collect(Collectors.joining(ROLE_SEPARATOR));
    }

    private static Set<Role> parseRoles(String roles) {
        if (roles == null || roles.isBlank()) {
            return EnumSet.of(Role.READER);
        }
        return Arrays.stream(roles.split(ROLE_SEPARATOR))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Role::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(Role.class)));
    }
}
