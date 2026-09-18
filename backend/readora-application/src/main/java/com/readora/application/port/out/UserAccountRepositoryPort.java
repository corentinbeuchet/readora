package com.readora.application.port.out;

import com.readora.domain.identity.Email;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.common.UserId;

import java.util.Optional;

public interface UserAccountRepositoryPort {
    Optional<UserAccount> findById(UserId id);
    Optional<UserAccount> findByEmail(Email email);
    Optional<UserAccount> findByExternalCustomerId(String externalCustomerId);
    Optional<UserAccount> findByExternalSubscriptionId(String externalSubscriptionId);
    boolean existsByEmail(Email email);
    boolean existsByUsername(String username);
    UserAccount save(UserAccount account);
}
