package com.readora.acceptance.steps;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.StoragePort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.application.service.ChapterReadingService;
import com.readora.application.service.ReaderSocialService;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.social.Bookmark;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.*;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;

public class ReaderViewerStepDefinitions {

    private final Map<WorkId, Work> workStore = new ConcurrentHashMap<>();
    private final Map<ChapterId, Chapter> chapterStore = new ConcurrentHashMap<>();
    private final Map<String, Bookmark> bookmarkStore = new ConcurrentHashMap<>();

    private ChapterReadingService chapterReadingService;
    private ReaderSocialService readerSocialService;

    private Work currentWork;
    private Chapter currentChapter;
    private Chapter loadedChapterResult;
    private Exception thrownException;

    @Before
    public void setup() {
        workStore.clear();
        chapterStore.clear();
        bookmarkStore.clear();
        thrownException = null;

        WorkRepositoryPort workRepo = new WorkRepositoryPort() {
            @Override
            public Optional<Work> findById(WorkId id) {
                return Optional.ofNullable(workStore.get(id));
            }

            @Override
            public Work save(Work work) {
                workStore.put(work.getId(), work);
                return work;
            }
        };

        ChapterRepositoryPort chapterRepo = new ChapterRepositoryPort() {
            @Override
            public Optional<Chapter> findById(ChapterId id) {
                return Optional.ofNullable(chapterStore.get(id));
            }

            @Override
            public List<Chapter> findByWorkId(WorkId workId) {
                return chapterStore.values().stream().filter(c -> c.getWorkId().equals(workId)).toList();
            }

            @Override
            public Chapter save(Chapter chapter) {
                chapterStore.put(chapter.getId(), chapter);
                return chapter;
            }
        };

        StoragePort storagePort = new StoragePort() {
            @Override
            public String generatePresignedUploadUrl(String objectKey, java.time.Duration validity) {
                return "https://s3.amazonaws.com/readora-media-test/" + objectKey + "?signature=mock";
            }

            @Override
            public String getPublicCdnUrl(String objectKey) {
                return "https://cdn.readora.com/" + objectKey;
            }
        };

        chapterReadingService = new ChapterReadingService(chapterRepo, storagePort);
    }

    @Given("the reader {string} is registered on Readora")
    public void readerIsRegistered(String readerName) {
        // Reader profile context
    }

    @Given("a published work {string} exists with {string} containing {int} pages")
    public void publishedWorkExists(String workTitle, String chapterName, int pageCount) {
        currentWork = Work.create(workTitle, "Synopsis for " + workTitle, WorkType.MANHWA, "https://cdn.readora.com/covers/solo.webp", Set.of("Action", "Fantasy"));
        workStore.put(currentWork.getId(), currentWork);

        String numStr = chapterName.replaceAll("[^0-9.]", "");
        ChapterNumber chapterNumber = ChapterNumber.of(numStr.isEmpty() ? "1" : numStr);

        List<PageAsset> pages = new ArrayList<>();
        for (int i = 1; i <= pageCount; i++) {
            pages.add(PageAsset.create(i, "scans/" + currentWork.getId() + "/" + chapterNumber + "/p" + i + ".webp", null));
        }

        currentChapter = new Chapter(
                ChapterId.generate(),
                currentWork.getId(),
                chapterNumber,
                chapterName,
                ChapterStatus.PUBLISHED,
                pages,
                null,
                Instant.now(),
                Instant.now(),
                Instant.now()
        );
        chapterStore.put(currentChapter.getId(), currentChapter);
    }

    @Given("{string} opens {string} of {string}")
    public void opensChapter(String readerName, String chapterName, String workTitle) {
        // Context setup
    }

    @When("{string} sets the view mode to {string}")
    public void setsViewMode(String readerName, String viewMode) {
        try {
            loadedChapterResult = chapterReadingService.readChapter(currentChapter.getId(), UserId.of(readerName), viewMode);
        } catch (Exception e) {
            thrownException = e;
        }
    }

    @Then("the viewer should render all {int} page assets in sequential order")
    public void verifyPageAssets(int expectedPageCount) {
        assertThat(loadedChapterResult).isNotNull();
        assertThat(loadedChapterResult.getPages()).hasSize(expectedPageCount);
        for (int i = 0; i < expectedPageCount; i++) {
            assertThat(loadedChapterResult.getPages().get(i).pageNumber()).isEqualTo(i + 1);
        }
    }

    @Then("the page URLs should point to optimized CDN edge endpoints")
    public void verifyCdnUrls() {
        assertThat(loadedChapterResult.getPages())
                .allMatch(p -> p.cdnUrl() != null && p.cdnUrl().startsWith("https://cdn.readora.com/"));
    }

    @Given("{string} is reading {string} of {string}")
    public void readerIsReadingChapter(String readerName, String chapterName, String workTitle) {
        // State initialized
    }

    @When("{string} scrolls to and views page {int}")
    public void readerScrollsToPage(String readerName, int pageIndex) {
        Bookmark bookmark = Bookmark.startReading(UserId.of(readerName), currentWork.getId(), currentChapter.getId(), pageIndex);
        bookmarkStore.put(readerName + ":" + currentWork.getId(), bookmark);
    }

    @Then("his reading bookmark for {string} should record {string} at page {int}")
    public void verifyBookmarkProgress(String workTitle, String chapterName, int pageIndex) {
        Bookmark bookmark = bookmarkStore.get("Kenji:" + currentWork.getId());
        assertThat(bookmark).isNotNull();
        assertThat(bookmark.getLastReadChapterId()).isEqualTo(currentChapter.getId());
        assertThat(bookmark.getLastReadPageIndex()).isEqualTo(pageIndex);
    }

    @Then("his reading status should be set to {string}")
    public void verifyReadingStatus(String statusStr) {
        Bookmark bookmark = bookmarkStore.get("Kenji:" + currentWork.getId());
        assertThat(bookmark.getStatus()).isEqualTo(ReadingStatus.valueOf(statusStr));
    }

    @Given("{string} of {string} has status {string}")
    public void chapterHasStatus(String chapterName, String workTitle, String statusStr) {
        String numStr = chapterName.replaceAll("[^0-9.]", "");
        ChapterNumber chapterNumber = ChapterNumber.of(numStr.isEmpty() ? "2" : numStr);

        currentChapter = new Chapter(
                ChapterId.generate(),
                currentWork.getId(),
                chapterNumber,
                chapterName,
                ChapterStatus.valueOf(statusStr),
                List.of(PageAsset.create(1, "draft/p1.webp", null)),
                null,
                Instant.now(),
                null,
                Instant.now()
        );
        chapterStore.put(currentChapter.getId(), currentChapter);
    }

    @When("{string} attempts to read {string}")
    public void readerAttemptsToRead(String readerName, String chapterName) {
        try {
            loadedChapterResult = chapterReadingService.readChapter(currentChapter.getId(), UserId.of(readerName), "VERTICAL");
        } catch (Exception e) {
            thrownException = e;
        }
    }

    @Then("the access should be rejected with a {string} error")
    public void verifyRejectionError(String expectedErrorCode) {
        assertThat(thrownException)
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining(expectedErrorCode);
    }
}
