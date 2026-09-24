package com.readora.infrastructure.config;

import com.readora.application.port.in.AuthenticateUserUseCase;
import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.application.port.in.CommunityUseCase;
import com.readora.application.port.in.DeleteAccountUseCase;
import com.readora.application.port.in.DirectPublishChapterUseCase;
import com.readora.application.port.in.DiscoverUseCase;
import com.readora.application.port.in.ExportMyDataUseCase;
import com.readora.application.port.in.ManageAssetsUseCase;
import com.readora.application.port.in.ManageBookmarkUseCase;
import com.readora.application.port.in.ManageLibraryUseCase;
import com.readora.application.port.in.ManageListsUseCase;
import com.readora.application.port.in.ManageProfileUseCase;
import com.readora.application.port.in.ManageScanlationTaskUseCase;
import com.readora.application.port.in.ManageTeamUseCase;
import com.readora.application.port.in.ManageWorkUseCase;
import com.readora.application.port.in.ModerateCommentsUseCase;
import com.readora.application.port.in.NotifyUseCase;
import com.readora.application.port.in.RateWorkUseCase;
import com.readora.application.port.in.ReadChapterUseCase;
import com.readora.application.port.in.ReaderInteractionUseCase;
import com.readora.application.port.in.ReportPageUseCase;
import com.readora.application.port.in.ResetPasswordUseCase;
import com.readora.application.port.in.ReviewChaptersUseCase;
import com.readora.application.port.in.TrackReadingUseCase;
import com.readora.application.port.out.*;
import com.readora.application.service.AccountDeletionService;
import com.readora.application.service.AccountExportService;
import com.readora.application.service.AssetService;
import com.readora.application.service.AuthenticationService;
import com.readora.application.service.BookmarkService;
import com.readora.application.service.CatalogService;
import com.readora.application.service.ChapterReadingService;
import com.readora.application.service.ChapterReviewService;
import com.readora.application.service.CommunityService;
import com.readora.application.service.DiscoveryService;
import com.readora.application.service.LibraryService;
import com.readora.application.service.ModerationService;
import com.readora.application.service.NotificationService;
import com.readora.application.service.PageReportService;
import com.readora.application.service.PasswordResetService;
import com.readora.application.service.ProfileService;
import com.readora.application.service.RatingService;
import com.readora.application.service.ReaderSocialService;
import com.readora.application.service.ReadingListService;
import com.readora.application.service.ReadingTrackerService;
import com.readora.application.service.ScanlationTaskService;
import com.readora.application.service.TeamManagementService;
import com.readora.application.service.WorkManagementService;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;

import static com.readora.infrastructure.config.UseCaseTransactions.transactional;

/// Wires the framework-free application services. Every `port.in` bean is wrapped by
/// [UseCaseTransactions#transactional] so each use-case call is atomic.
@Configuration
@EnableConfigurationProperties({SecurityProperties.class, CommentProperties.class, MailProperties.class})
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
            TeamRepositoryPort teamRepository,
            UserAccountRepositoryPort userRepository,
            EventPublisherPort eventPublisher) {
        return new WorkManagementService(workRepository, chapterRepository, projectRepository, teamRepository, userRepository, eventPublisher,
                Clock.systemUTC());
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
            WorkRepositoryPort workRepository,
            TeamRepositoryPort teamRepository,
            StoragePort storagePort) {
        return transactional(new ChapterReadingService(chapterRepository, workRepository, teamRepository, storagePort),
                ReadChapterUseCase.class, transactionManager);
    }

    @Bean
    public ManageScanlationTaskUseCase manageScanlationTaskUseCase(
            ScanlationProjectRepositoryPort projectRepository,
            TeamRepositoryPort teamRepository,
            ChapterRepositoryPort chapterRepository,
            EventPublisherPort eventPublisher,
            UserAccountRepositoryPort userRepository) {
        return transactional(new ScanlationTaskService(projectRepository, teamRepository, chapterRepository, eventPublisher, userRepository),
                ManageScanlationTaskUseCase.class, transactionManager);
    }

    @Bean
    public ReaderInteractionUseCase readerInteractionUseCase(
            CommentRepositoryPort commentRepository,
            ChapterRepositoryPort chapterRepository,
            EventPublisherPort eventPublisher,
            CommentProperties commentProperties) {
        return transactional(new ReaderSocialService(commentRepository, chapterRepository, eventPublisher, Clock.systemUTC(),
                        commentProperties.minInterval()),
                ReaderInteractionUseCase.class, transactionManager);
    }

    @Bean
    public AuthenticateUserUseCase authenticateUserUseCase(
            UserAccountRepositoryPort userRepository,
            RefreshTokenRepositoryPort refreshTokenRepository,
            PasswordHasherPort passwordHasher,
            TokenProviderPort tokenProvider,
            SecurityProperties securityProperties) {
        return transactional(new AuthenticationService(userRepository, refreshTokenRepository, passwordHasher, tokenProvider,
                        securityProperties.jwt().refreshReuseGrace()),
                AuthenticateUserUseCase.class, transactionManager);
    }

    @Bean
    public ResetPasswordUseCase resetPasswordUseCase(UserAccountRepositoryPort users, PasswordResetTokenRepositoryPort resetTokens,
                                                     RefreshTokenRepositoryPort refreshTokens, TokenProviderPort tokenProvider,
                                                     PasswordHasherPort passwordHasher, MailPort mail, MailProperties mailProperties) {
        return transactional(new PasswordResetService(users, resetTokens, refreshTokens, tokenProvider, passwordHasher, mail, Clock.systemUTC(),
                mailProperties.siteUrl()), ResetPasswordUseCase.class, transactionManager);
    }

    @Bean
    public DeleteAccountUseCase deleteAccountUseCase(UserAccountRepositoryPort users, TeamRepositoryPort teams, ReaderDataErasurePort erasure,
                                                     RefreshTokenRepositoryPort refreshTokens, PasswordResetTokenRepositoryPort resetTokens,
                                                     PasswordHasherPort passwordHasher) {
        return transactional(new AccountDeletionService(users, teams, erasure, refreshTokens, resetTokens, passwordHasher, Clock.systemUTC()),
                DeleteAccountUseCase.class, transactionManager);
    }

    @Bean
    public ExportMyDataUseCase exportMyDataUseCase(UserAccountRepositoryPort users, ReaderDataExportPort readerData) {
        return transactional(new AccountExportService(users, readerData, Clock.systemUTC()), ExportMyDataUseCase.class, transactionManager);
    }

    @Bean
    public ManageProfileUseCase manageProfileUseCase(UserAccountRepositoryPort userRepository) {
        return transactional(new ProfileService(userRepository), ManageProfileUseCase.class, transactionManager);
    }

    @Bean
    public ManageBookmarkUseCase manageBookmarkUseCase(
            BookmarkRepositoryPort bookmarkRepository,
            UserAccountRepositoryPort userRepository,
            ChapterRepositoryPort chapterRepository) {
        return transactional(new BookmarkService(bookmarkRepository, userRepository, chapterRepository),
                ManageBookmarkUseCase.class, transactionManager);
    }

    /// No persistence involved, so no transaction (it would hold a DB connection during large uploads).
    @Bean
    public ManageAssetsUseCase manageAssetsUseCase(StoragePort storagePort, ImageVariantPort imageVariantPort) {
        return new AssetService(storagePort, imageVariantPort);
    }

    @Bean
    public ManageLibraryUseCase manageLibraryUseCase(
            LibraryRepositoryPort libraryRepository,
            WorkRepositoryPort workRepository,
            ChapterReadRepositoryPort chapterReadRepository) {
        return transactional(new LibraryService(libraryRepository, workRepository, chapterReadRepository, Clock.systemUTC()),
                ManageLibraryUseCase.class, transactionManager);
    }

    @Bean
    public TrackReadingUseCase trackReadingUseCase(
            ChapterReadRepositoryPort chapterReadRepository,
            ChapterRepositoryPort chapterRepository,
            WorkRepositoryPort workRepository) {
        return transactional(new ReadingTrackerService(chapterReadRepository, chapterRepository, workRepository, Clock.systemUTC()),
                TrackReadingUseCase.class, transactionManager);
    }

    @Bean
    public ReportPageUseCase reportPageUseCase(
            PageReportRepositoryPort reportRepository,
            ChapterRepositoryPort chapterRepository,
            ScanlationProjectRepositoryPort projectRepository,
            TeamRepositoryPort teamRepository,
            UserAccountRepositoryPort userRepository) {
        return transactional(new PageReportService(reportRepository, chapterRepository, projectRepository, teamRepository, userRepository,
                        Clock.systemUTC()),
                ReportPageUseCase.class, transactionManager);
    }

    @Bean
    public RateWorkUseCase rateWorkUseCase(RatingRepositoryPort ratingRepository, WorkRepositoryPort workRepository) {
        return transactional(new RatingService(ratingRepository, workRepository, Clock.systemUTC()), RateWorkUseCase.class,
                transactionManager);
    }

    @Bean
    public DiscoverUseCase discoverUseCase(DiscoveryQueryPort discovery, WorkRepositoryPort workRepository, RatingRepositoryPort ratingRepository,
                                           TeamRepositoryPort teamRepository) {
        return transactional(new DiscoveryService(discovery, workRepository, ratingRepository, teamRepository, Clock.systemUTC()), DiscoverUseCase.class,
                transactionManager);
    }

    @Bean
    public NotifyUseCase notifyUseCase(NotificationRepositoryPort notifications, LibraryRepositoryPort library,
                                       ChapterRepositoryPort chapters, WorkRepositoryPort works, CommentRepositoryPort comments,
                                       TeamInvitationRepositoryPort invitations, TeamRepositoryPort teams,
                                       ScanlationProjectRepositoryPort projects, UserAccountRepositoryPort users) {
        return transactional(new NotificationService(notifications, library, chapters, works, comments, invitations, teams, projects, users,
                        Clock.systemUTC()),
                NotifyUseCase.class, transactionManager);
    }

    @Bean
    public ModerateCommentsUseCase moderateCommentsUseCase(CommentReportRepositoryPort reports, CommentRepositoryPort comments,
                                                           UserAccountRepositoryPort users) {
        return transactional(new ModerationService(reports, comments, users, Clock.systemUTC()), ModerateCommentsUseCase.class,
                transactionManager);
    }

    @Bean
    public ReviewChaptersUseCase reviewChaptersUseCase(ChapterRepositoryPort chapters, WorkRepositoryPort works, TeamRepositoryPort teams,
                                                       UserAccountRepositoryPort users, EventPublisherPort eventPublisher) {
        return transactional(new ChapterReviewService(chapters, works, teams, users, eventPublisher), ReviewChaptersUseCase.class,
                transactionManager);
    }

    @Bean
    public CommunityUseCase communityUseCase(UserAccountRepositoryPort users, CommunityQueryPort community,
                                             TeamRepositoryPort teams, ScanlationProjectRepositoryPort projects, WorkRepositoryPort works) {
        return transactional(new CommunityService(users, community, teams, projects, works, Clock.systemUTC()), CommunityUseCase.class,
                transactionManager);
    }

    @Bean
    public ManageListsUseCase manageListsUseCase(ReadingListRepositoryPort lists, WorkRepositoryPort works) {
        return transactional(new ReadingListService(lists, works, Clock.systemUTC()), ManageListsUseCase.class, transactionManager);
    }

    @Bean
    public ManageTeamUseCase manageTeamUseCase(TeamRepositoryPort teams, ScanlationProjectRepositoryPort projects, WorkRepositoryPort works,
                                               UserAccountRepositoryPort users, TeamInvitationRepositoryPort invitations,
                                               EventPublisherPort eventPublisher) {
        return transactional(new TeamManagementService(teams, projects, works, users, invitations, eventPublisher, Clock.systemUTC()),
                ManageTeamUseCase.class,
                transactionManager);
    }

    @Bean
    public BrowseCatalogUseCase browseCatalogUseCase(
            WorkRepositoryPort workRepository,
            ChapterRepositoryPort chapterRepository,
            ScanlationProjectRepositoryPort projectRepository,
            TeamRepositoryPort teamRepository,
            UserAccountRepositoryPort userRepository,
            CommunityQueryPort communityQueries) {
        return transactional(new CatalogService(workRepository, chapterRepository, projectRepository, teamRepository, userRepository, communityQueries),
                BrowseCatalogUseCase.class, transactionManager);
    }
}
