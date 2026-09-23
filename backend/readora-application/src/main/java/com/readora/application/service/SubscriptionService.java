package com.readora.application.service;

import com.readora.application.port.in.ManageSubscriptionUseCase;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Subscription;

import java.util.Objects;

public class SubscriptionService implements ManageSubscriptionUseCase {
    private final UserAccountRepositoryPort userRepository;

    public SubscriptionService(UserAccountRepositoryPort userRepository) {
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
    }

    @Override
    public Subscription getCurrent(UserId userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId))
                .getSubscription();
    }
}
