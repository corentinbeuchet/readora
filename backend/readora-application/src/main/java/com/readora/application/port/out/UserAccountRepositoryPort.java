package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.UserAccount;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public interface UserAccountRepositoryPort {
    Optional<UserAccount> findById(UserId id);

    /// The usernames of these accounts, in one query in adapters (not one per account).
    default Map<UserId, String> findUsernames(Collection<UserId> ids) {
        return ids.stream().distinct().flatMap(id -> findById(id).stream())
                .collect(Collectors.toMap(UserAccount::getId, UserAccount::getUsername));
    }
    Optional<UserAccount> findByEmail(Email email);
    /// Case-insensitive.
    Optional<UserAccount> findByUsername(String username);
    boolean existsByEmail(Email email);
    boolean existsByUsername(String username);
    UserAccount save(UserAccount account);

    /// Accounts whose username or email starts with `prefix` (case-insensitive), deleted ones left out, by username.
    List<UserAccount> search(String prefix, int limit);
}
