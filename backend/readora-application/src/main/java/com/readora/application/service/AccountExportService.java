package com.readora.application.service;

import com.readora.application.port.in.ExportMyDataUseCase;
import com.readora.application.port.out.ReaderDataExportPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.UserAccount;

import java.time.Clock;
import java.util.Objects;

public class AccountExportService implements ExportMyDataUseCase {

    private final UserAccountRepositoryPort users;
    private final ReaderDataExportPort readerData;
    private final Clock clock;

    public AccountExportService(UserAccountRepositoryPort users, ReaderDataExportPort readerData, Clock clock) {
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.readerData = Objects.requireNonNull(readerData, "ReaderDataExportPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public AccountExport export(UserId userId) {
        UserAccount account = users.findById(userId).filter(found -> !found.isDeleted())
                .orElseThrow(() -> new NotFoundException("Account", userId));
        return new AccountExport(account.getUsername(), account.getEmail().value(), account.getDisplayName(), account.getBio(),
                account.getAvatarUrl(), account.getRoles().stream().map(Enum::name).sorted().toList(), account.getCreatedAt(),
                clock.instant(), readerData.dataOf(userId));
    }
}
