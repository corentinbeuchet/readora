package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryPageReportRepository;
import com.readora.acceptance.fakes.InMemoryProjectRepository;
import com.readora.acceptance.fakes.InMemoryTeamRepository;
import com.readora.acceptance.fakes.NoUserAccounts;
import com.readora.application.service.PageReportService;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.UserId;
import com.readora.domain.report.PageReport;
import com.readora.domain.report.PageReportReason;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkType;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.jspecify.annotations.Nullable;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/// US-06 broken-page reports (zen mode is @ui).
public class ReaderCustomizationStepDefinitions {

    private static final Map<String, PageReportReason> REASONS = Map.of(
            "Image corrupted", PageReportReason.IMAGE_CORRUPTED,
            "Missing page", PageReportReason.MISSING_PAGE,
            "Wrong order", PageReportReason.WRONG_ORDER,
            "Low quality", PageReportReason.LOW_QUALITY);

    private InMemoryProjectRepository projects;
    private InMemoryTeamRepository teams;
    private InMemoryChapterRepository chapters;
    private PageReportService reports;
    private ScanlationProject team;
    private UserId leader;
    private Chapter chapter;
    private @Nullable RuntimeException refusal;

    @Before
    public void setup() {
        projects = new InMemoryProjectRepository();
        teams = new InMemoryTeamRepository();
        chapters = new InMemoryChapterRepository();
        reports = new PageReportService(new InMemoryPageReportRepository(), chapters, projects, teams, new NoUserAccounts(),
                Clock.systemUTC());
        refusal = null;
    }

    @Given("reader {string} is reading chapter {int} of {string}, translated by the team {string}")
    public void readerIsReadingChapterTranslatedBy(String reader, int number, String title, String teamName) {
        Work work = Work.create(title, "", WorkType.MANHWA, "", Set.of());
        leader = UserId.of(teamName + " leader");
        Team roster = teams.save(Team.create(teamName, null, leader));
        team = projects.save(ScanlationProject.create(teamName, work.getId(), roster.getId()));
        Chapter draft = Chapter.createDraft(work.getId(), ChapterNumber.of(String.valueOf(number)), "Chapter " + number, roster.getId());
        draft.updatePages(IntStream.rangeClosed(1, 20).mapToObj(n -> PageAsset.create(n, "p" + n + ".webp", null)).toList());
        draft.publish(leader);
        chapter = chapters.save(draft);
    }

    @When("{string} reports page {int} as {string}")
    @Given("{string} reported page {int} as {string}")
    public void reportsPageAs(String reader, int page, String reason) {
        reports.report(UserId.of(reader), chapter.getId(), page, REASONS.get(reason));
    }

    @Then("the team {string} sees {int} open report, for page {int} of chapter {int}")
    public void theTeamSeesOpenReport(String teamName, int count, int page, int chapterNumber) {
        List<PageReport> open = reports.openReports(leader, team.getId());
        assertThat(open).hasSize(count).allSatisfy(report -> {
            assertThat(report.getPageNumber()).isEqualTo(page);
            assertThat(report.getChapterNumber().value()).isEqualTo(String.valueOf(chapterNumber));
        });
    }

    @When("a member of {string} marks the report as fixed")
    public void aMemberMarksTheReportAsFixed(String teamName) {
        PageReport open = reports.openReports(leader, team.getId()).getFirst();
        reports.resolve(leader, open.getId());
    }

    @Then("the team {string} sees no open report")
    public void theTeamSeesNoOpenReport(String teamName) {
        assertThat(reports.openReports(leader, team.getId())).isEmpty();
    }

    @When("reader {string} asks for the open reports of {string}")
    public void readerAsksForTheOpenReports(String reader, String teamName) {
        try {
            reports.openReports(UserId.of(reader), team.getId());
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    @Then("the request is refused")
    public void theRequestIsRefused() {
        assertThat(refusal).isInstanceOf(AccessDeniedDomainException.class);
    }
}
