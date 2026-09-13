package com.readora.domain.identity;

import com.readora.domain.common.DomainValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserAccountDomainTest {

    private static UserAccount newReader() {
        return UserAccount.register(Email.of("Reader@Example.com"), "reader_1", PasswordHash.of("$2a$hash"));
    }

    @Test
    @DisplayName("Registering a user grants the READER role, normalises the email and emits UserRegisteredEvent")
    void registerGrantsReaderRole() {
        UserAccount account = newReader();

        assertThat(account.getRoles()).containsExactly(Role.READER);
        assertThat(account.getEmail().value()).isEqualTo("reader@example.com");
        assertThat(account.effectivePermissions()).containsExactlyInAnyOrder(Permission.COMMENT_WRITE, Permission.COMMENT_UPVOTE);
        assertThat(account.can(Permission.BOOKMARK_WRITE)).isFalse();
        assertThat(account.getDomainEvents()).singleElement().isInstanceOf(UserRegisteredEvent.class);
    }

    @Test
    @DisplayName("Effective permissions are the union of role and active plan permissions")
    void activeSubscriptionAddsPlanPermissions() {
        UserAccount account = newReader();
        account.activateSubscription(Subscription.active(SubscriptionPlan.PREMIUM, Instant.now().plus(Duration.ofDays(30)), "cus_1", "sub_1"));

        assertThat(account.can(Permission.BOOKMARK_READ)).isTrue();
        assertThat(account.can(Permission.BOOKMARK_WRITE)).isTrue();
        assertThat(account.can(Permission.CHAPTER_PUBLISH)).isFalse();
        assertThat(account.getDomainEvents()).anySatisfy(e -> assertThat(e).isInstanceOf(SubscriptionActivatedEvent.class));
    }

    @Test
    @DisplayName("Expired or canceled subscriptions do not grant plan permissions")
    void expiredOrCanceledSubscriptionGrantsNothing() {
        UserAccount expired = newReader();
        expired.activateSubscription(Subscription.active(SubscriptionPlan.PREMIUM, Instant.now().minus(Duration.ofDays(1)), "cus_1", "sub_1"));
        assertThat(expired.can(Permission.BOOKMARK_WRITE)).isFalse();

        UserAccount canceled = newReader();
        canceled.activateSubscription(Subscription.active(SubscriptionPlan.PREMIUM, Instant.now().plus(Duration.ofDays(30)), "cus_2", "sub_2"));
        canceled.cancelSubscription();
        assertThat(canceled.can(Permission.BOOKMARK_WRITE)).isFalse();
        assertThat(canceled.getSubscription().getStatus()).isEqualTo(SubscriptionStatus.CANCELED);
        assertThat(canceled.getDomainEvents()).anySatisfy(e -> assertThat(e).isInstanceOf(SubscriptionCanceledEvent.class));
    }

    @Test
    @DisplayName("Granting SCANLATOR adds pipeline permissions; ADMIN grants everything")
    void grantRoleExtendsPermissions() {
        UserAccount account = newReader();
        account.grantRole(Role.SCANLATOR);

        assertThat(account.can(Permission.TASK_CLAIM)).isTrue();
        assertThat(account.can(Permission.CHAPTER_PUBLISH)).isTrue();
        assertThat(account.can(Permission.USER_MANAGE)).isFalse();

        account.grantRole(Role.ADMIN);
        assertThat(account.effectivePermissions()).containsExactlyInAnyOrder(Permission.values());
    }

    @Test
    @DisplayName("Invalid email, username or FREE plan activation are rejected")
    void validationRules() {
        assertThatThrownBy(() -> Email.of("not-an-email"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> UserAccount.register(Email.of("a@b.io"), "x", PasswordHash.of("h")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("Username must be between");
        assertThatThrownBy(() -> newReader().activateSubscription(Subscription.free()))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> newReader().revokeRole(Role.READER))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    @DisplayName("updateProfile applies trimmed display name, bio and avatar")
    void updateProfile() {
        UserAccount account = newReader();
        account.updateProfile("  Jane  ", "Reads a lot", "  ");

        assertThat(account.getDisplayName()).isEqualTo("Jane");
        assertThat(account.getBio()).isEqualTo("Reads a lot");
        assertThat(account.getAvatarUrl()).isNull();
        assertThatThrownBy(() -> account.updateProfile("   ", null, null))
                .isInstanceOf(DomainValidationException.class);
    }
}
