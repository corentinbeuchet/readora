package com.readora.application.service;

import com.readora.application.port.in.AdministerAccountsUseCase;
import com.readora.application.port.in.CheckAccountStandingUseCase;
import com.readora.application.port.out.RefreshTokenRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.AccountStanding;
import com.readora.domain.identity.Permission;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.UserAccount;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BiConsumer;

public class AccountAdministrationService implements AdministerAccountsUseCase, CheckAccountStandingUseCase {

    private final UserAccountRepositoryPort users;
    private final RefreshTokenRepositoryPort refreshTokens;
    private final Clock clock;

    public AccountAdministrationService(UserAccountRepositoryPort users, RefreshTokenRepositoryPort refreshTokens, Clock clock) {
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.refreshTokens = Objects.requireNonNull(refreshTokens, "RefreshTokenRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public List<UserAccount> search(UserId actorId, String query) {
        requireAdmin(actorId);
        String prefix = query == null ? "" : query.trim();
        if (prefix.length() < SEARCH_MIN) {
            throw new DomainValidationException("Type at least " + SEARCH_MIN + " characters of a username or email");
        }
        return users.search(prefix, SEARCH_LIMIT);
    }

    @Override
    public UserAccount assignRole(UserId actorId, UserId accountId, Role role) {
        return administer(actorId, accountId, (account, now) -> account.assignRole(role, now));
    }

    @Override
    public UserAccount suspend(UserId actorId, UserId accountId, int days) {
        if (days < 1 || days > MAX_SUSPENSION_DAYS) {
            throw new DomainValidationException("A suspension lasts 1 to " + MAX_SUSPENSION_DAYS + " days");
        }
        UserAccount suspended = administer(actorId, accountId, (account, now) -> account.suspendUntil(now.plus(Duration.ofDays(days)), now));
        refreshTokens.deleteAllForUser(accountId);
        return suspended;
    }

    @Override
    public UserAccount ban(UserId actorId, UserId accountId) {
        UserAccount banned = administer(actorId, accountId, (account, now) -> account.ban(now));
        refreshTokens.deleteAllForUser(accountId);
        return banned;
    }

    @Override
    public UserAccount reinstate(UserId actorId, UserId accountId) {
        return administer(actorId, accountId, (account, now) -> account.reinstate(now));
    }

    @Override
    public Optional<AccountStanding> standingOf(UserId userId) {
        Instant now = clock.instant();
        return users.findById(userId).filter(account -> !account.isDeleted()).map(account -> account.standingAt(now));
    }

    private UserAccount administer(UserId actorId, UserId accountId, BiConsumer<UserAccount, Instant> change) {
        requireAdmin(actorId);
        if (actorId.equals(accountId)) {
            throw DomainValidationException.withCode(ErrorCodes.SELF_ADMINISTRATION, "An admin does not administer their own account");
        }
        UserAccount account = users.findById(accountId).filter(found -> !found.isDeleted())
                .orElseThrow(() -> new NotFoundException("Account", accountId));
        change.accept(account, clock.instant());
        return users.save(account);
    }

    private void requireAdmin(UserId actorId) {
        boolean admin = users.findById(actorId).map(account -> account.can(Permission.USER_MANAGE)).orElse(false);
        if (!admin) {
            throw new AccessDeniedDomainException("Only admins look after accounts");
        }
    }
}
