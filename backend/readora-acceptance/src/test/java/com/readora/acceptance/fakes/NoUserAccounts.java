package com.readora.acceptance.fakes;

import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.UserAccount;

import java.util.Optional;

/// No stored accounts: nobody is an admin (scenarios where only team membership matters).
public class NoUserAccounts implements UserAccountRepositoryPort {
    @Override
    public Optional<UserAccount> findById(UserId id) {
        return Optional.empty();
    }

    @Override
    public Optional<UserAccount> findByEmail(Email email) {
        return Optional.empty();
    }

    @Override
    public Optional<UserAccount> findByExternalCustomerId(String externalCustomerId) {
        return Optional.empty();
    }

    @Override
    public Optional<UserAccount> findByExternalSubscriptionId(String externalSubscriptionId) {
        return Optional.empty();
    }

    @Override
    public boolean existsByEmail(Email email) {
        return false;
    }

    @Override
    public boolean existsByUsername(String username) {
        return false;
    }

    @Override
    public UserAccount save(UserAccount account) {
        throw new UnsupportedOperationException("no accounts in these scenarios");
    }
}
