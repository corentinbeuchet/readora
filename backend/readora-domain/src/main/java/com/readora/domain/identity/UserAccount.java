package com.readora.domain.identity;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;

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
    private String avatarUrl;
    private final Set<Role> roles = EnumSet.noneOf(Role.class);
    private Subscription subscription;
    private final Instant createdAt;
    private Instant updatedAt;

    public UserAccount(UserId id, Email email, String username, PasswordHash passwordHash, String displayName, String bio,
                       String avatarUrl, Set<Role> roles, Subscription subscription, Instant createdAt, Instant updatedAt) {
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
        this.subscription = subscription != null ? subscription : Subscription.free();
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static UserAccount register(Email email, String username, PasswordHash passwordHash) {
        Instant now = Instant.now();
        UserAccount account = new UserAccount(
                UserId.of(UUID.randomUUID().toString()),
                email, username, passwordHash, username, "", null,
                EnumSet.of(Role.READER), Subscription.free(), now, now
        );
        account.registerEvent(UserRegisteredEvent.now(account.getId(), email));
        return account;
    }

    public Set<Permission> effectivePermissions() {
        EnumSet<Permission> permissions = EnumSet.noneOf(Permission.class);
        for (Role role : roles) {
            permissions.addAll(role.permissions());
        }
        if (subscription.isActive(Instant.now())) {
            permissions.addAll(subscription.getPlan().permissions());
        }
        return Collections.unmodifiableSet(permissions);
    }

    public boolean can(Permission permission) {
        return effectivePermissions().contains(permission);
    }

    public void updateProfile(String newDisplayName, String newBio, String newAvatarUrl) {
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

    public void changePassword(PasswordHash newPasswordHash) {
        this.passwordHash = Objects.requireNonNull(newPasswordHash, "PasswordHash cannot be null");
        this.updatedAt = Instant.now();
    }

    public void activateSubscription(Subscription newSubscription) {
        Objects.requireNonNull(newSubscription, "Subscription cannot be null");
        if (newSubscription.getPlan() == SubscriptionPlan.FREE) {
            throw new DomainValidationException("Cannot activate the FREE plan as a paid subscription");
        }
        this.subscription = newSubscription;
        this.updatedAt = Instant.now();
        registerEvent(SubscriptionActivatedEvent.now(this.id, newSubscription.getPlan(), newSubscription.getCurrentPeriodEnd()));
    }

    public void updateSubscription(Subscription updatedSubscription) {
        this.subscription = Objects.requireNonNull(updatedSubscription, "Subscription cannot be null");
        this.updatedAt = Instant.now();
    }

    public void cancelSubscription() {
        if (this.subscription.getPlan() == SubscriptionPlan.FREE) {
            return;
        }
        SubscriptionPlan previousPlan = this.subscription.getPlan();
        this.subscription = this.subscription.withStatus(SubscriptionStatus.CANCELED);
        this.updatedAt = Instant.now();
        registerEvent(SubscriptionCanceledEvent.now(this.id, previousPlan));
    }

    /// The user stopped renewal: access continues until the paid period ends, when the provider's deletion
    /// event cancels the subscription for good.
    public void scheduleSubscriptionCancellation() {
        if (this.subscription.getPlan() == SubscriptionPlan.FREE || this.subscription.isCancelAtPeriodEnd()) {
            return;
        }
        this.subscription = this.subscription.withCancelAtPeriodEnd(true);
        this.updatedAt = Instant.now();
        registerEvent(SubscriptionCanceledEvent.now(this.id, this.subscription.getPlan()));
    }

    public void grantRole(Role role) {
        Objects.requireNonNull(role, "Role cannot be null");
        if (this.roles.add(role)) {
            this.updatedAt = Instant.now();
        }
    }

    public void revokeRole(Role role) {
        Objects.requireNonNull(role, "Role cannot be null");
        if (role == Role.READER) {
            throw new DomainValidationException("The READER role cannot be revoked");
        }
        if (this.roles.remove(role)) {
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

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public Set<Role> getRoles() {
        return Collections.unmodifiableSet(roles);
    }

    public Subscription getSubscription() {
        return subscription;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
