package com.readora.domain.common;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public abstract class AggregateRoot<ID extends Serializable> extends Entity<ID> {
    private final List<DomainEvent> domainEvents = new ArrayList<>();
    private Long version;

    protected AggregateRoot(ID id) {
        super(id);
    }

    protected void registerEvent(DomainEvent event) {
        if (event != null) {
            this.domainEvents.add(event);
        }
    }

    public List<DomainEvent> pollDomainEvents() {
        List<DomainEvent> events = new ArrayList<>(this.domainEvents);
        this.domainEvents.clear();
        return Collections.unmodifiableList(events);
    }

    /// Optimistic-locking token owned by the persistence adapter: `null` until the aggregate is first stored.
    /// Domain logic must not read or change it.
    public Long getVersion() {
        return version;
    }

    /// Called by repository adapters after loading or saving, so the next save can detect concurrent writes.
    public void restoreVersion(Long version) {
        this.version = version;
    }

    public List<DomainEvent> getDomainEvents() {
        return Collections.unmodifiableList(this.domainEvents);
    }
}
