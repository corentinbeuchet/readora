package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.identity.AccountStanding;

import java.util.Optional;

/// Asked on every write (US-16): an access token outlives a suspension, a ban or a deletion by up to its lifetime.
public interface CheckAccountStandingUseCase {

    /// The account's standing now; empty when it no longer exists or was deleted.
    Optional<AccountStanding> standingOf(UserId userId);
}
