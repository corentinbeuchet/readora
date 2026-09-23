package com.readora.application.port.in;

import com.readora.domain.identity.UserAccount;
import com.readora.domain.common.UserId;

public interface ManageProfileUseCase {
    UserAccount updateProfile(UserId userId, String displayName, String bio, String avatarUrl);
}
