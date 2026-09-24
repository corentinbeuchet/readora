package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.PasswordResetTokenRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.PasswordResetToken;
import com.readora.infrastructure.persistence.entity.PasswordResetTokenJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataPasswordResetTokenRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Component
public class PasswordResetTokenRepositoryAdapter implements PasswordResetTokenRepositoryPort {

    private final SpringDataPasswordResetTokenRepository springDataRepository;

    public PasswordResetTokenRepositoryAdapter(SpringDataPasswordResetTokenRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional
    public PasswordResetToken save(PasswordResetToken token) {
        return toDomain(springDataRepository.save(new PasswordResetTokenJpaEntity(token.getId(), token.getUserId().value(), token.getTokenHash(),
                token.getExpiresAt(), token.getUsedAt(), token.getCreatedAt())));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<PasswordResetToken> findByTokenHash(String tokenHash) {
        return springDataRepository.findByTokenHash(tokenHash).map(this::toDomain);
    }

    @Override
    @Transactional
    public void deleteAllForUser(UserId userId) {
        springDataRepository.deleteAllForUser(userId.value());
    }

    private PasswordResetToken toDomain(PasswordResetTokenJpaEntity entity) {
        return new PasswordResetToken(entity.getId(), UserId.of(entity.getUserId()), entity.getTokenHash(), entity.getExpiresAt(),
                entity.getUsedAt(), entity.getCreatedAt());
    }
}
