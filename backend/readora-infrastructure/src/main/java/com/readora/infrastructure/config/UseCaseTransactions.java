package com.readora.infrastructure.config;

import com.readora.application.port.in.ReadOnly;
import com.readora.domain.identity.InvalidCredentialsException;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.transaction.TransactionManager;
import org.springframework.transaction.interceptor.NoRollbackRuleAttribute;
import org.springframework.transaction.interceptor.RollbackRuleAttribute;
import org.springframework.transaction.interceptor.RuleBasedTransactionAttribute;
import org.springframework.transaction.interceptor.TransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

import java.util.List;

/// Wraps a use-case implementation in a transactional proxy, so every call of a `port.in` method is one
/// transaction (REQUIRED, rolled back on runtime exceptions) while `readora-application` stays Spring-free.
///
/// Repository adapters' own `@Transactional` methods join this transaction, so a use case that saves several
/// aggregates either commits all of them or none. Exception: an [InvalidCredentialsException] commits, so security
/// side effects of a rejected credential (revoking a stolen refresh-token family) are kept.
///
/// A method marked [ReadOnly] on the use-case interface runs in a read-only transaction (no flush, no dirty-checking
/// snapshots, a read-only connection).
public final class UseCaseTransactions {

    private UseCaseTransactions() {
    }

    public static <T> T transactional(T target, Class<T> useCase, TransactionManager transactionManager) {
        ProxyFactory factory = new ProxyFactory(target);
        factory.setInterfaces(useCase);
        RuleBasedTransactionAttribute readWrite = attribute(false);
        RuleBasedTransactionAttribute readOnly = attribute(true);
        TransactionAttributeSource source = (method, targetClass) ->
                AnnotatedElementUtils.hasAnnotation(method, ReadOnly.class) ? readOnly : readWrite;
        factory.addAdvice(new TransactionInterceptor(transactionManager, source));
        return useCase.cast(factory.getProxy());
    }

    private static RuleBasedTransactionAttribute attribute(boolean readOnly) {
        RuleBasedTransactionAttribute attribute = new RuleBasedTransactionAttribute();
        attribute.setReadOnly(readOnly);
        attribute.setRollbackRules(List.of(
                new NoRollbackRuleAttribute(InvalidCredentialsException.class),
                new RollbackRuleAttribute(RuntimeException.class)));
        return attribute;
    }
}
