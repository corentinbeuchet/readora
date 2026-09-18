package com.readora.infrastructure.config;

import org.springframework.aop.framework.ProxyFactory;
import org.springframework.transaction.TransactionManager;
import org.springframework.transaction.interceptor.MatchAlwaysTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

/// Wraps a use-case implementation in a transactional proxy, so every call of a `port.in` method is one
/// transaction (REQUIRED, rolled back on any `RuntimeException`) while `readora-application` stays Spring-free.
///
/// Repository adapters' own `@Transactional` methods join this transaction, so a use case that saves several
/// aggregates either commits all of them or none.
public final class UseCaseTransactions {

    private UseCaseTransactions() {
    }

    public static <T> T transactional(T target, Class<T> useCase, TransactionManager transactionManager) {
        ProxyFactory factory = new ProxyFactory(target);
        factory.setInterfaces(useCase);
        factory.addAdvice(new TransactionInterceptor(transactionManager, new MatchAlwaysTransactionAttributeSource()));
        return useCase.cast(factory.getProxy());
    }
}
