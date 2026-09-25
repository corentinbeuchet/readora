package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.AccountStanding;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.UserAccount;
import com.readora.infrastructure.persistence.entity.UserAccountJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataUserAccountRepository;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    @Transactional(readOnly = true)
    public Map<UserId, String> findUsernames(Collection<UserId> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return springDataRepository.findUsernamesByIds(ids.stream().map(UserId::value).distinct().toList()).stream()
                .collect(Collectors.toMap(row -> UserId.of((String) row[0]), row -> (String) row[1]));
    }

    @Override
    public Optional<UserAccount> findByEmail(Email email) {
        return springDataRepository.findByEmail(email.value()).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserAccount> findByUsername(String username) {
        return springDataRepository.findByUsernameIgnoreCase(username).map(this::toDomain);
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
        UserAccountJpaEntity saved = OptimisticLocking.flush(account, "UserAccount", () -> springDataRepository.saveAndFlush(entity));
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
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getDeletedAt(),
                AccountStanding.valueOf(entity.getStanding()),
                entity.getSuspendedUntil()
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
        entity.setDeletedAt(account.getDeletedAt());
        entity.setStanding(account.getStanding().name());
        entity.setSuspendedUntil(account.getSuspendedUntil());

        return entity;
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
    @Override
    @Transactional(readOnly = true)
    public List<UserAccount> search(String prefix, int limit) {
        String literal = prefix.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return springDataRepository.searchByUsernameOrEmail(literal, Limit.of(limit)).stream().map(this::toDomain).toList();
    }
}
