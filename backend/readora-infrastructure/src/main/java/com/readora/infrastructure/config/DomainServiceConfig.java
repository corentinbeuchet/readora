package com.readora.infrastructure.config;

import com.readora.application.port.in.AuthenticateUserUseCase;
import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.application.port.in.DirectPublishChapterUseCase;
import com.readora.application.port.in.ManageBookmarkUseCase;
import com.readora.application.port.in.ManageProfileUseCase;
import com.readora.application.port.in.ManageScanlationTaskUseCase;
import com.readora.application.port.in.ManageSubscriptionUseCase;
import com.readora.application.port.in.ManageWorkUseCase;
import com.readora.application.port.in.ReadChapterUseCase;
import com.readora.application.port.in.ReaderInteractionUseCase;
import com.readora.application.port.out.*;
import com.readora.application.service.AuthenticationService;
import com.readora.application.service.BookmarkService;
import com.readora.application.service.CatalogService;
import com.readora.application.service.ChapterReadingService;
import com.readora.application.service.ProfileService;
import com.readora.application.service.ReaderSocialService;
import com.readora.application.service.ScanlationTaskService;
import com.readora.application.service.SubscriptionService;
import com.readora.application.service.WorkManagementService;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import static com.readora.infrastructure.config.UseCaseTransactions.transactional;

/// Wires the framework-free application services. Every `port.in` bean is wrapped by
/// [UseCaseTransactions#transactional] so each use-case call is atomic.
@Configuration
@EnableConfigurationProperties({SecurityProperties.class, StripeProperties.class})
public class DomainServiceConfig {

    private final PlatformTransactionManager transactionManager;

    public DomainServiceConfig(PlatformTransactionManager transactionManager) {
        this.transactionManager = transactionManager;
    }

    @Bean
    public WorkManagementService workManagementService(
            WorkRepositoryPort workRepository,
            ChapterRepositoryPort chapterRepository,
            ScanlationProjectRepositoryPort projectRepository,
            UserAccountRepositoryPort userRepository,
            EventPublisherPort eventPublisher) {
        return new WorkManagementService(workRepository, chapterRepository, projectRepository, userRepository, eventPublisher);
    }

    @Bean
    public ManageWorkUseCase manageWorkUseCase(WorkManagementService workManagementService) {
        return transactional(workManagementService, ManageWorkUseCase.class, transactionManager);
    }

    @Bean
    public DirectPublishChapterUseCase directPublishChapterUseCase(WorkManagementService workManagementService) {
        return transactional(workManagementService, DirectPublishChapterUseCase.class, transactionManager);
    }

    @Bean
    public ReadChapterUseCase readChapterUseCase(
            ChapterRepositoryPort chapterRepository,
            StoragePort storagePort) {
        return transactional(new ChapterReadingService(chapterRepository, storagePort),
                ReadChapterUseCase.class, transactionManager);
    }

    @Bean
    public ManageScanlationTaskUseCase manageScanlationTaskUseCase(
            ScanlationProjectRepositoryPort projectRepository,
            ChapterRepositoryPort chapterRepository,
            EventPublisherPort eventPublisher) {
        return transactional(new ScanlationTaskService(projectRepository, chapterRepository, eventPublisher),
                ManageScanlationTaskUseCase.class, transactionManager);
    }

    @Bean
    public ReaderInteractionUseCase readerInteractionUseCase(
            CommentRepositoryPort commentRepository,
            ChapterRepositoryPort chapterRepository,
            EventPublisherPort eventPublisher) {
        return transactional(new ReaderSocialService(commentRepository, chapterRepository, eventPublisher),
                ReaderInteractionUseCase.class, transactionManager);
    }

    @Bean
    public AuthenticateUserUseCase authenticateUserUseCase(
            UserAccountRepositoryPort userRepository,
            RefreshTokenRepositoryPort refreshTokenRepository,
            PasswordHasherPort passwordHasher,
            TokenProviderPort tokenProvider,
            EventPublisherPort eventPublisher) {
        return transactional(new AuthenticationService(userRepository, refreshTokenRepository, passwordHasher, tokenProvider, eventPublisher),
                AuthenticateUserUseCase.class, transactionManager);
    }

    @Bean
    public ManageProfileUseCase manageProfileUseCase(UserAccountRepositoryPort userRepository) {
        return transactional(new ProfileService(userRepository), ManageProfileUseCase.class, transactionManager);
    }

    @Bean
    public ManageBookmarkUseCase manageBookmarkUseCase(
            BookmarkRepositoryPort bookmarkRepository,
            UserAccountRepositoryPort userRepository,
            ChapterRepositoryPort chapterRepository,
            EventPublisherPort eventPublisher) {
        return transactional(new BookmarkService(bookmarkRepository, userRepository, chapterRepository, eventPublisher),
                ManageBookmarkUseCase.class, transactionManager);
    }

    @Bean
    public ManageSubscriptionUseCase manageSubscriptionUseCase(
            UserAccountRepositoryPort userRepository,
            PaymentPort paymentPort,
            EventPublisherPort eventPublisher) {
        return transactional(new SubscriptionService(userRepository, paymentPort, eventPublisher),
                ManageSubscriptionUseCase.class, transactionManager);
    }

    @Bean
    public BrowseCatalogUseCase browseCatalogUseCase(
            WorkRepositoryPort workRepository,
            ChapterRepositoryPort chapterRepository,
            ScanlationProjectRepositoryPort projectRepository) {
        return transactional(new CatalogService(workRepository, chapterRepository, projectRepository),
                BrowseCatalogUseCase.class, transactionManager);
    }
}
