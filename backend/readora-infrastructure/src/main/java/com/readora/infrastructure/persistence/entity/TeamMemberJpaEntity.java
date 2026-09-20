package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "team_members")
public class TeamMemberJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private TeamJpaEntity team;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @ElementCollection(fetch = FetchType.LAZY)
    @BatchSize(size = 64)
    @CollectionTable(name = "member_roles", joinColumns = @JoinColumn(name = "member_id"))
    @Column(name = "role")
    private List<String> roles;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    public TeamMemberJpaEntity() {}

    public TeamMemberJpaEntity(TeamJpaEntity team, String userId, List<String> roles, Instant joinedAt) {
        this.team = team;
        this.userId = userId;
        this.roles = roles;
        this.joinedAt = joinedAt;
    }

    public UUID getId() { return id; }
    public TeamJpaEntity getTeam() { return team; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public List<String> getRoles() { return roles; }
    public void setRoles(List<String> roles) { this.roles = roles; }
    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }
}
