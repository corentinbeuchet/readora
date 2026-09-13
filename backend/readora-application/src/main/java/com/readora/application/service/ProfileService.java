package com.readora.application.service;

import com.readora.application.port.in.ManageProfileUseCase;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.work.UserId;

import java.util.Objects;

public class ProfileService implements ManageProfileUseCase {
    private final UserAccountRepositoryPort userRepository;

    public ProfileService(UserAccountRepositoryPort userRepository) {
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
    }

    @Override
    public UserAccount getProfile(UserId userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new DomainValidationException("User not found: " + userId));
    }

    @Override
    public UserAccount updateProfile(UserId userId, String displayName, String bio, String avatarUrl) {
        UserAccount account = getProfile(userId);
        account.updateProfile(displayName, bio, avatarUrl);
        return userRepository.save(account);
    }
}
