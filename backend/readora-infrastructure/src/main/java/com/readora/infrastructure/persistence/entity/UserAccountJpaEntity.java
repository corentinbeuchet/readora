package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users")
public class UserAccountJpaEntity {

    @Id
    @Column(length = 100)
    private String id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(length = 1000)
    private String bio;

    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    @Column(nullable = false)
    private String roles;


    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }

    public Long getVersion() {
        return version;
    }

    public UserAccountJpaEntity() {}

    public UserAccountJpaEntity(String id, String email, String username, String passwordHash, String displayName, String bio,
                                String avatarUrl, String roles, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.email = email;
        this.username = username;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.bio = bio;
        this.avatarUrl = avatarUrl;
        this.roles = roles;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() { return id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getRoles() { return roles; }
    public void setRoles(String roles) { this.roles = roles; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
