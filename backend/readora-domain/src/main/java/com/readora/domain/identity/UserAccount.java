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

    private final Email email;
    private final String username;
    private PasswordHash passwordHash;
    private String displayName;
    private String bio;
    private @Nullable String avatarUrl;
    private final Set<Role> roles = EnumSet.noneOf(Role.class);
    private final Instant createdAt;
    private Instant updatedAt;

    public UserAccount(UserId id, Email email, String username, PasswordHash passwordHash, @Nullable String displayName,
                       @Nullable String bio, @Nullable String avatarUrl, @Nullable Set<Role> roles,
                       @Nullable Instant createdAt, @Nullable Instant updatedAt) {
        super(id);
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
