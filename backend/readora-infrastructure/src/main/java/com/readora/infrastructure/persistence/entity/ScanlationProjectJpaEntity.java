package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "scanlation_projects")
public class ScanlationProjectJpaEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "work_id", nullable = false)
    private UUID workId;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @BatchSize(size = 64)
    private List<WorkflowTaskJpaEntity> tasks = new ArrayList<>();

    @Column(name = "board_enabled", nullable = false)
    private boolean boardEnabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getVersion() {
        return version;
    }

    public ScanlationProjectJpaEntity() {}

    public ScanlationProjectJpaEntity(UUID id, String name, UUID workId, UUID teamId, boolean boardEnabled, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.name = name;
        this.workId = workId;
        this.teamId = teamId;
        this.boardEnabled = boardEnabled;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public UUID getWorkId() { return workId; }
    public void setWorkId(UUID workId) { this.workId = workId; }
    public UUID getTeamId() { return teamId; }
    public boolean isBoardEnabled() { return boardEnabled; }
    public void setBoardEnabled(boolean boardEnabled) { this.boardEnabled = boardEnabled; }
    public List<WorkflowTaskJpaEntity> getTasks() { return tasks; }
    public void setTasks(List<WorkflowTaskJpaEntity> tasks) { this.tasks = tasks; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
