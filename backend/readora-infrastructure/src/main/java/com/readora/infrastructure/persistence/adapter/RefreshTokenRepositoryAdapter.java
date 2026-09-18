package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.RefreshTokenRepositoryPort;
import com.readora.domain.identity.RefreshToken;
import com.readora.domain.work.UserId;
import com.readora.infrastructure.persistence.entity.RefreshTokenJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataRefreshTokenRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Component
public class RefreshTokenRepositoryAdapter implements RefreshTokenRepositoryPort {

    private final SpringDataRefreshTokenRepository springDataRepository;

    public RefreshTokenRepositoryAdapter(SpringDataRefreshTokenRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Optional<RefreshToken> findByTokenHash(String tokenHash) {
        return springDataRepository.findByTokenHash(tokenHash).map(this::toDomain);
    }

    @Override
    @Transactional
    public RefreshToken save(RefreshToken token) {
        RefreshTokenJpaEntity saved = springDataRepository.save(toEntity(token));
        return toDomain(saved);
    }

    @Override
    @Transactional
    public void revokeAllForUser(UserId userId) {
        springDataRepository.revokeAllForUser(userId.value(), Instant.now());
    }

    @Override
    @Transactional
    public boolean revokeIfActive(String tokenHash, Instant now) {
        return springDataRepository.revokeIfActive(tokenHash, now) == 1;
    }

    @Override
    @Transactional
    public void deleteExpiredBefore(Instant threshold) {
        springDataRepository.deleteExpiredBefore(threshold);
    }

    private RefreshToken toDomain(RefreshTokenJpaEntity entity) {
        return new RefreshToken(
                entity.getId(),
                UserId.of(entity.getUserId()),
                entity.getTokenHash(),
                entity.getExpiresAt(),
                entity.getRevokedAt(),
                entity.getCreatedAt()
        );
    }

    private RefreshTokenJpaEntity toEntity(RefreshToken token) {
        return new RefreshTokenJpaEntity(
                token.getId(),
                token.getUserId().value(),
                token.getTokenHash(),
                token.getExpiresAt(),
                token.getRevokedAt(),
                token.getCreatedAt()
        );
    }
}
