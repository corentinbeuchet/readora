package com.readora.domain.identity;

import com.readora.domain.common.DomainValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserAccountDomainTest {

    private static UserAccount newReader() {
        return UserAccount.register(Email.of("Reader@Example.com"), "reader_1", PasswordHash.of("$2a$hash"));
    }

    @Test
    @DisplayName("Registering a user grants the READER role and normalises the email")
    void registerGrantsReaderRole() {
        UserAccount account = newReader();

        assertThat(account.getRoles()).containsExactly(Role.READER);
        assertThat(account.getEmail().value()).isEqualTo("reader@example.com");
        assertThat(account.effectivePermissions()).containsExactlyInAnyOrder(Permission.COMMENT_WRITE, Permission.COMMENT_UPVOTE, Permission.LIBRARY_USE, Permission.PAGE_REPORT, Permission.RATE_WORK, Permission.COMMENT_REPORT);
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
    @DisplayName("An invalid email or username is rejected")
    void validationRules() {
        assertThatThrownBy(() -> Email.of("not-an-email"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> UserAccount.register(Email.of("a@b.io"), "x", PasswordHash.of("h")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("Username must be between");
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

    @Test
    @DisplayName("Moderators can moderate comments; readers and scanlators cannot")
    void moderatorRole() {
        assertThat(Role.MODERATOR.permissions()).contains(Permission.COMMENT_MODERATE, Permission.COMMENT_REPORT, Permission.COMMENT_WRITE);
        assertThat(Role.READER.permissions()).doesNotContain(Permission.COMMENT_MODERATE);
        assertThat(Role.SCANLATOR.permissions()).doesNotContain(Permission.COMMENT_MODERATE);
        assertThat(Role.ADMIN.permissions()).contains(Permission.COMMENT_MODERATE);
    }
}
