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

@Configuration
@EnableConfigurationProperties({SecurityProperties.class, StripeProperties.class})
public class DomainServiceConfig {

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
        return workManagementService;
    }

    @Bean
    public DirectPublishChapterUseCase directPublishChapterUseCase(WorkManagementService workManagementService) {
        return workManagementService;
    }

    @Bean
    public ReadChapterUseCase readChapterUseCase(
            ChapterRepositoryPort chapterRepository,
            StoragePort storagePort,
            EventPublisherPort eventPublisher) {
        return new ChapterReadingService(chapterRepository, storagePort, eventPublisher);
    }

    @Bean
    public ManageScanlationTaskUseCase manageScanlationTaskUseCase(
            ScanlationProjectRepositoryPort projectRepository,
            ChapterRepositoryPort chapterRepository,
            EventPublisherPort eventPublisher) {
        return new ScanlationTaskService(projectRepository, chapterRepository, eventPublisher);
    }

    @Bean
    public ReaderInteractionUseCase readerInteractionUseCase(
            CommentRepositoryPort commentRepository,
            BookmarkRepositoryPort bookmarkRepository,
            EventPublisherPort eventPublisher) {
        return new ReaderSocialService(commentRepository, bookmarkRepository, eventPublisher);
    }

    @Bean
    public AuthenticateUserUseCase authenticateUserUseCase(
            UserAccountRepositoryPort userRepository,
            RefreshTokenRepositoryPort refreshTokenRepository,
            PasswordHasherPort passwordHasher,
            TokenProviderPort tokenProvider,
            EventPublisherPort eventPublisher) {
        return new AuthenticationService(userRepository, refreshTokenRepository, passwordHasher, tokenProvider, eventPublisher);
    }

    @Bean
    public ManageProfileUseCase manageProfileUseCase(UserAccountRepositoryPort userRepository) {
        return new ProfileService(userRepository);
    }

    @Bean
    public ManageBookmarkUseCase manageBookmarkUseCase(
            BookmarkRepositoryPort bookmarkRepository,
            UserAccountRepositoryPort userRepository,
            EventPublisherPort eventPublisher) {
        return new BookmarkService(bookmarkRepository, userRepository, eventPublisher);
    }

    @Bean
    public ManageSubscriptionUseCase manageSubscriptionUseCase(
            UserAccountRepositoryPort userRepository,
            PaymentPort paymentPort,
            EventPublisherPort eventPublisher) {
        return new SubscriptionService(userRepository, paymentPort, eventPublisher);
    }

    @Bean
    public BrowseCatalogUseCase browseCatalogUseCase(
            WorkRepositoryPort workRepository,
            ChapterRepositoryPort chapterRepository,
            ScanlationProjectRepositoryPort projectRepository) {
        return new CatalogService(workRepository, chapterRepository, projectRepository);
    }
}
