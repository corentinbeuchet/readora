package com.readora.application.service;

import com.readora.application.port.in.DeleteAccountUseCase;
import com.readora.application.port.out.PasswordHasherPort;
import com.readora.application.port.out.PasswordResetTokenRepositoryPort;
import com.readora.application.port.out.ReaderDataErasurePort;
import com.readora.application.port.out.RefreshTokenRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.Team;

import java.time.Clock;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class AccountDeletionService implements DeleteAccountUseCase {

    private final UserAccountRepositoryPort users;
    private final TeamRepositoryPort teams;
    private final ReaderDataErasurePort erasure;
    private final RefreshTokenRepositoryPort refreshTokens;
    private final PasswordResetTokenRepositoryPort resetTokens;
    private final PasswordHasherPort passwordHasher;
    private final Clock clock;

    public AccountDeletionService(UserAccountRepositoryPort users, TeamRepositoryPort teams, ReaderDataErasurePort erasure,
                                  RefreshTokenRepositoryPort refreshTokens, PasswordResetTokenRepositoryPort resetTokens,
                                  PasswordHasherPort passwordHasher, Clock clock) {
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.teams = Objects.requireNonNull(teams, "TeamRepositoryPort cannot be null");
        this.erasure = Objects.requireNonNull(erasure, "ReaderDataErasurePort cannot be null");
        this.refreshTokens = Objects.requireNonNull(refreshTokens, "RefreshTokenRepositoryPort cannot be null");
        this.resetTokens = Objects.requireNonNull(resetTokens, "PasswordResetTokenRepositoryPort cannot be null");
        this.passwordHasher = Objects.requireNonNull(passwordHasher, "PasswordHasherPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public void deleteAccount(UserId userId, String password) {
        UserAccount account = users.findById(userId).filter(found -> !found.isDeleted())
                .orElseThrow(() -> new NotFoundException("Account", userId));
        if (password == null || !passwordHasher.matches(password, account.getPasswordHash())) {
            throw DomainValidationException.withCode(ErrorCodes.WRONG_PASSWORD, "The password is wrong");
        }
        // Leave every team in memory first: an only leader (LAST_LEADER) stops everything before anything is saved.
        List<Team> memberships = teams.findByMember(userId);
        memberships.forEach(team -> team.removeMember(userId));

        String placeholder = "deleted_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        account.erase(placeholder, Email.of(placeholder + "@deleted.invalid"), passwordHasher.hash(UUID.randomUUID().toString()),
                clock.instant());
        memberships.forEach(teams::save);
        users.save(account);
        erasure.renameCommentAuthor(userId, placeholder);
        erasure.eraseReaderData(userId);
        refreshTokens.deleteAllForUser(userId);
        resetTokens.deleteAllForUser(userId);
    }
}
