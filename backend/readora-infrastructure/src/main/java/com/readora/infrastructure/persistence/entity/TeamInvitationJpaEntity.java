package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "team_invitations")
public class TeamInvitationJpaEntity {

    @Id
    private UUID id;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @Column(name = "invitee_id", nullable = false, length = 100)
    private String inviteeId;

    /// Comma-separated `ScanlationRole` names.
    @Column(nullable = false, length = 200)
    private String roles;

    @Column(name = "invited_by", nullable = false, length = 100)
    private String invitedBy;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "answered_at")
    private Instant answeredAt;

    @Version
    @Column(nullable = false)
    private Long version;

    protected TeamInvitationJpaEntity() {
    }

    public TeamInvitationJpaEntity(UUID id, UUID teamId, String inviteeId, String roles, String invitedBy, String status, Instant createdAt) {
        this.id = id;
        this.teamId = teamId;
        this.inviteeId = inviteeId;
        this.roles = roles;
        this.invitedBy = invitedBy;
        this.status = status;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getTeamId() { return teamId; }
    public String getInviteeId() { return inviteeId; }
    public String getRoles() { return roles; }
    public String getInvitedBy() { return invitedBy; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getAnsweredAt() { return answeredAt; }
    public void setAnsweredAt(Instant answeredAt) { this.answeredAt = answeredAt; }
    public Long getVersion() { return version; }
}
