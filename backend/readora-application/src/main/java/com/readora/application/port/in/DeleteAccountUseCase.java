package com.readora.application.port.in;

import com.readora.domain.common.UserId;

/// Deleting my account (US-15).
public interface DeleteAccountUseCase {

    /// Leaves every team, erases what only the reader had, keeps comments and reviews under a placeholder name, and
    /// ends every session. Nothing changes when it is refused.
    ///
    /// @throws com.readora.domain.common.DomainValidationException `WRONG_PASSWORD` if `password` is wrong;
    ///         `LAST_LEADER` if the reader is the only leader of a team
    /// @throws com.readora.domain.common.NotFoundException if the account no longer exists
    void deleteAccount(UserId userId, String password);
}
