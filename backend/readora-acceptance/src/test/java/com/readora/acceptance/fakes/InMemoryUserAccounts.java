package com.readora.acceptance.fakes;

import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.UserAccount;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryUserAccounts implements UserAccountRepositoryPort {

    private final Map<UserId, UserAccount> accounts = new ConcurrentHashMap<>();

    @Override
    public Optional<UserAccount> findById(UserId id) {
        return Optional.ofNullable(accounts.get(id));
    }

    @Override
    public Optional<UserAccount> findByEmail(Email email) {
        return accounts.values().stream().filter(a -> a.getEmail().equals(email)).findFirst();
    }

    @Override
    public Optional<UserAccount> findByUsername(String username) {
        return accounts.values().stream().filter(a -> a.getUsername().equalsIgnoreCase(username)).findFirst();
    }

    @Override
    public boolean existsByEmail(Email email) {
        return findByEmail(email).isPresent();
    }

    @Override
    public boolean existsByUsername(String username) {
        return accounts.values().stream().anyMatch(a -> a.getUsername().equals(username));
    }

    @Override
    public UserAccount save(UserAccount account) {
        accounts.put(account.getId(), account);
        return account;
    }
}
