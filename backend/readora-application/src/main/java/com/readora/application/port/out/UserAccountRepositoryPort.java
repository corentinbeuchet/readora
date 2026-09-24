package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.UserAccount;

import java.util.List;
import java.util.Optional;

public interface UserAccountRepositoryPort {
    Optional<UserAccount> findById(UserId id);
    Optional<UserAccount> findByEmail(Email email);
    /// Case-insensitive.
    Optional<UserAccount> findByUsername(String username);
    boolean existsByEmail(Email email);
    boolean existsByUsername(String username);
    UserAccount save(UserAccount account);

    /// Accounts whose username or email starts with `prefix` (case-insensitive), deleted ones left out, by username.
    List<UserAccount> search(String prefix, int limit);
}
