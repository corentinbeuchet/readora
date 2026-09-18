package com.readora.infrastructure.persistence.adapter;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.ConcurrentModificationDomainException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.util.Objects;
import java.util.function.Supplier;

/// Bridges JPA `@Version` columns and [AggregateRoot#getVersion()].
///
/// Adapters load the row, call [#verify] before copying state onto it, then `saveAndFlush` so Hibernate's
/// `UPDATE ... WHERE version = ?` also catches a writer that committed in between.
final class OptimisticLocking {

    private OptimisticLocking() {
    }

    /// @throws ConcurrentModificationDomainException if the aggregate was loaded at an older version than the row
    static void verify(AggregateRoot<?> aggregate, Long persistedVersion, String aggregateType) {
        Long loadedVersion = aggregate.getVersion();
        if (loadedVersion != null && !Objects.equals(loadedVersion, persistedVersion)) {
            throw new ConcurrentModificationDomainException(aggregateType, aggregate.getId());
        }
    }

    /// Runs a `saveAndFlush`, translating Hibernate's stale-version failure into the domain exception.
    static <E> E flush(AggregateRoot<?> aggregate, String aggregateType, Supplier<E> saveAndFlush) {
        try {
            return saveAndFlush.get();
        } catch (OptimisticLockingFailureException e) {
            throw new ConcurrentModificationDomainException(aggregateType, aggregate.getId());
        }
    }

    static <A extends AggregateRoot<?>> A restored(A aggregate, Long version) {
        aggregate.restoreVersion(version);
        return aggregate;
    }
}
