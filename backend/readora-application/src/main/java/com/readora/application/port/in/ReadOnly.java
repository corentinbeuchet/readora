package com.readora.application.port.in;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/// Marks a use-case method that only reads. Infrastructure runs it in a read-only transaction
/// (`UseCaseTransactions`): nothing is flushed, loaded entities keep no dirty-checking snapshot, and PostgreSQL
/// rejects any write. Never put it on a method that saves, even rarely (a write would be lost or refused).
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface ReadOnly {
}
