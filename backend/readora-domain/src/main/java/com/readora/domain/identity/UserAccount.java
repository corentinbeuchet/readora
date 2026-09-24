package com.readora.domain.identity;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Collections;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

public class UserAccount extends AggregateRoot<UserId> {
    public static final int USERNAME_MIN_LENGTH = 3;
    public static final int USERNAME_MAX_LENGTH = 50;
    public static final int DISPLAY_NAME_MAX_LENGTH = 100;
    public static final int BIO_MAX_LENGTH = 1000;

    private Email email;
    private String username;
    private PasswordHash passwordHash;
    private String displayName;
    private String bio;
    private @Nullable String avatarUrl;
    private final Set<Role> roles = EnumSet.noneOf(Role.class);
    private final Instant createdAt;
    private Instant updatedAt;
    /// When the owner deleted the account (US-15); the row stays so comments and reviews keep an author.
    private @Nullable Instant deletedAt;
    private AccountStanding standing;
    private @Nullable Instant suspendedUntil;

    public UserAccount(UserId id, Email email, String username, PasswordHash passwordHash, @Nullable String displayName,
                       @Nullable String bio, @Nullable String avatarUrl, @Nullable Set<Role> roles,
                       @Nullable Instant createdAt, @Nullable Instant updatedAt) {
        this(id, email, username, passwordHash, displayName, bio, avatarUrl, roles, createdAt, updatedAt, null);
    }

    public UserAccount(UserId id, Email email, String username, PasswordHash passwordHash, @Nullable String displayName,
                       @Nullable String bio, @Nullable String avatarUrl, @Nullable Set<Role> roles,
                       @Nullable Instant createdAt, @Nullable Instant updatedAt, @Nullable Instant deletedAt) {
        this(id, email, username, passwordHash, displayName, bio, avatarUrl, roles, createdAt, updatedAt, deletedAt, AccountStanding.ACTIVE, null);
    }

    public UserAccount(UserId id, Email email, String username, PasswordHash passwordHash, @Nullable String displayName,
                       @Nullable String bio, @Nullable String avatarUrl, @Nullable Set<Role> roles,
                       @Nullable Instant createdAt, @Nullable Instant updatedAt, @Nullable Instant deletedAt,
                       AccountStanding standing, @Nullable Instant suspendedUntil) {
        super(id);
        this.deletedAt = deletedAt;
        this.standing = Objects.requireNonNull(standing, "AccountStanding cannot be null");
        this.suspendedUntil = suspendedUntil;
        this.email = Objects.requireNonNull(email, "Email cannot be null");
        this.username = validateUsername(username);
        this.passwordHash = Objects.requireNonNull(passwordHash, "PasswordHash cannot be null");
        this.displayName = displayName != null && !displayName.isBlank() ? displayName : this.username;
        this.bio = bio != null ? bio : "";
        this.avatarUrl = avatarUrl;
        if (roles != null) {
            this.roles.addAll(roles);
        }
        if (this.roles.isEmpty()) {
            this.roles.add(Role.READER);
        }
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static UserAccount register(Email email, String username, PasswordHash passwordHash) {
        Instant now = Instant.now();
        UserAccount account = new UserAccount(
                UserId.of(UUID.randomUUID().toString()),
                email, username, passwordHash, username, "", null,
                EnumSet.of(Role.READER), now, now
        );
        return account;
    }

    public Set<Permission> effectivePermissions() {
        EnumSet<Permission> permissions = EnumSet.noneOf(Permission.class);
        for (Role role : roles) {
            permissions.addAll(role.permissions());
        }
        return Collections.unmodifiableSet(permissions);
    }

    public boolean can(Permission permission) {
        return effectivePermissions().contains(permission);
    }

    public void updateProfile(@Nullable String newDisplayName, @Nullable String newBio, @Nullable String newAvatarUrl) {
        if (newDisplayName != null) {
            String trimmed = newDisplayName.trim();
            if (trimmed.isEmpty()) {
                throw new DomainValidationException("Display name cannot be blank");
            }
            if (trimmed.length() > DISPLAY_NAME_MAX_LENGTH) {
                throw new DomainValidationException("Display name cannot exceed " + DISPLAY_NAME_MAX_LENGTH + " characters");
            }
            this.displayName = trimmed;
        }
        if (newBio != null) {
            if (newBio.length() > BIO_MAX_LENGTH) {
                throw new DomainValidationException("Bio cannot exceed " + BIO_MAX_LENGTH + " characters");
            }
            this.bio = newBio;
        }
        this.avatarUrl = newAvatarUrl != null && !newAvatarUrl.isBlank() ? newAvatarUrl.trim() : null;
        this.updatedAt = Instant.now();
    }

    /// The owner chose a new password (the caller checked the current one).
    public void changePassword(PasswordHash newHash) {
        this.passwordHash = Objects.requireNonNull(newHash, "PasswordHash cannot be null");
        this.updatedAt = Instant.now();
    }

    /// The owner deleted the account (US-15): nothing personal is left and it can never sign in again. The row keeps
    /// its id under `placeholderUsername` so the comments and reviews written with it keep an author.
    public void erase(String placeholderUsername, Email unreachableEmail, PasswordHash unusablePassword, Instant now) {
        this.username = validateUsername(placeholderUsername);
        this.email = Objects.requireNonNull(unreachableEmail, "Email cannot be null");
        this.passwordHash = Objects.requireNonNull(unusablePassword, "PasswordHash cannot be null");
        this.displayName = this.username;
        this.bio = "";
        this.avatarUrl = null;
        this.roles.clear();
        this.roles.add(Role.READER);
        this.deletedAt = now;
        this.updatedAt = now;
    }

    /// The standing at `now`: a suspension whose date has passed counts as lifted.
    public AccountStanding standingAt(Instant now) {
        if (standing == AccountStanding.SUSPENDED && suspendedUntil != null && !now.isBefore(suspendedUntil)) {
            return AccountStanding.ACTIVE;
        }
        return standing;
    }

    /// May sign in and write at `now` (US-16).
    public boolean isInGoodStanding(Instant now) {
        return !isDeleted() && standingAt(now) == AccountStanding.ACTIVE;
    }

    /// An admin keeps the account out until `until` (US-16).
    public void suspendUntil(Instant until, Instant now) {
        this.standing = AccountStanding.SUSPENDED;
        this.suspendedUntil = Objects.requireNonNull(until, "until cannot be null");
        this.updatedAt = now;
    }

    /// An admin keeps the account out until reinstated (US-16).
    public void ban(Instant now) {
        this.standing = AccountStanding.BANNED;
        this.suspendedUntil = null;
        this.updatedAt = now;
    }

    public void reinstate(Instant now) {
        this.standing = AccountStanding.ACTIVE;
        this.suspendedUntil = null;
        this.updatedAt = now;
    }

    /// An admin sets the one role the account has (US-16): reader, moderator or admin.
    public void assignRole(Role role, Instant now) {
        Objects.requireNonNull(role, "Role cannot be null");
        this.roles.clear();
        this.roles.add(role);
        this.updatedAt = now;
    }

    public AccountStanding getStanding() {
        return standing;
    }

    public @Nullable Instant getSuspendedUntil() {
        return suspendedUntil;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public @Nullable Instant getDeletedAt() {
        return deletedAt;
    }

    public void grantRole(Role role) {
        Objects.requireNonNull(role, "Role cannot be null");
        if (this.roles.add(role)) {
            this.updatedAt = Instant.now();
        }
    }

    private static String validateUsername(String username) {
        Objects.requireNonNull(username, "Username cannot be null");
        String trimmed = username.trim();
        if (trimmed.length() < USERNAME_MIN_LENGTH || trimmed.length() > USERNAME_MAX_LENGTH) {
            throw new DomainValidationException("Username must be between " + USERNAME_MIN_LENGTH + " and " + USERNAME_MAX_LENGTH + " characters");
        }
        if (!trimmed.matches("[A-Za-z0-9_.-]+")) {
            throw new DomainValidationException("Username may only contain letters, digits, '_', '.' and '-'");
        }
        return trimmed;
    }

    public Email getEmail() {
        return email;
    }

    public String getUsername() {
        return username;
    }

    public PasswordHash getPasswordHash() {
        return passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getBio() {
        return bio;
    }

    public @Nullable String getAvatarUrl() {
        return avatarUrl;
    }

    public Set<Role> getRoles() {
        return Collections.unmodifiableSet(roles);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
