package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "subscriptions")
public class SubscriptionJpaEntity {

    @Id
    @Column(name = "user_id", length = 100)
    private String userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private UserAccountJpaEntity user;

    @Column(nullable = false)
    private String plan;

    @Column(nullable = false)
    private String status;

    @Column(name = "current_period_end")
    private Instant currentPeriodEnd;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public SubscriptionJpaEntity() {}

    public SubscriptionJpaEntity(String plan, String status, Instant currentPeriodEnd, Instant updatedAt) {
        this.plan = plan;
        this.status = status;
        this.currentPeriodEnd = currentPeriodEnd;
        this.updatedAt = updatedAt;
    }

    public String getUserId() { return userId; }
    public void setUser(UserAccountJpaEntity user) {
        this.user = user;
        this.userId = user != null ? user.getId() : null;
    }
    public String getPlan() { return plan; }
    public void setPlan(String plan) { this.plan = plan; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCurrentPeriodEnd() { return currentPeriodEnd; }
    public void setCurrentPeriodEnd(Instant currentPeriodEnd) { this.currentPeriodEnd = currentPeriodEnd; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
