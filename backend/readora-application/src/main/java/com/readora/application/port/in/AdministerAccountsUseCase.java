package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.UserAccount;

import java.util.List;

/// Looking after accounts (US-16), for admins (`USER_MANAGE`). An admin never acts on their own account.
///
/// Every method throws `AccessDeniedDomainException` unless the actor may manage users, `NotFoundException` for an unknown
/// or deleted account, and `DomainValidationException` `SELF_ADMINISTRATION` when the actor is the target.
public interface AdministerAccountsUseCase {
    int SEARCH_LIMIT = 20;
    int SEARCH_MIN = 2;
    int MAX_SUSPENSION_DAYS = 365;

    /// Accounts whose username or email starts with `query`.
    List<UserAccount> search(UserId actorId, String query);

    UserAccount assignRole(UserId actorId, UserId accountId, Role role);

    /// Keeps the account out for `days` (1 to 365); its sessions end now.
    UserAccount suspend(UserId actorId, UserId accountId, int days);

    /// Keeps the account out until reinstated; its sessions end now.
    UserAccount ban(UserId actorId, UserId accountId);

    UserAccount reinstate(UserId actorId, UserId accountId);
}
