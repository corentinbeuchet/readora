package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.FakeTokens;
import com.readora.acceptance.fakes.InMemoryPasswordResetTokens;
import com.readora.acceptance.fakes.InMemoryReaderData;
import com.readora.acceptance.fakes.InMemoryReaderExport;
import com.readora.acceptance.fakes.InMemoryRefreshTokens;
import com.readora.acceptance.fakes.InMemoryTeamRepository;
import com.readora.acceptance.fakes.InMemoryUserAccounts;
import com.readora.acceptance.fakes.MutableClock;
import com.readora.acceptance.fakes.RecordingMail;
import com.readora.application.export.ReaderData;
import com.readora.application.port.in.AuthenticateUserUseCase.AuthResult;
import com.readora.application.port.in.ExportMyDataUseCase.AccountExport;
import com.readora.application.port.in.ResetPasswordUseCase.SiteLanguage;
import com.readora.application.service.AccountDeletionService;
import com.readora.application.service.AccountExportService;
import com.readora.application.service.AuthenticationService;
import com.readora.application.service.PasswordResetService;
import com.readora.domain.common.CodedException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.InvalidCredentialsException;
import com.readora.domain.scanlation.Team;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.jspecify.annotations.Nullable;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/// US-15 My account, through the real `AuthenticationService` and `PasswordResetService` over in-memory accounts,
/// tokens and a mailbox.
public class MyAccountStepDefinitions {

    private AuthenticationService auth;
    private PasswordResetService resets;
    private RecordingMail mail;
    private MutableClock clock;
    private AccountDeletionService deletion;
    private InMemoryUserAccounts accountRepository;
    private InMemoryTeamRepository teams;
    private InMemoryReaderData readerData;
    private InMemoryReaderExport readerExport;
    private AccountExportService exports;
    private AccountExport exported;
    /// The refresh token of each signed-in device, by "<reader> <device>".
    private final Map<String, String> devices = new HashMap<>();
    private final Map<String, UserId> accounts = new HashMap<>();
    private @Nullable RuntimeException refusal;

    @Before
    public void setup() {
        FakeTokens tokens = new FakeTokens();
        accountRepository = new InMemoryUserAccounts();
        InMemoryRefreshTokens refreshTokens = new InMemoryRefreshTokens();
        auth = new AuthenticationService(accountRepository, refreshTokens, tokens, tokens);
        mail = new RecordingMail();
        clock = new MutableClock(Instant.now());
        InMemoryPasswordResetTokens resetTokens = new InMemoryPasswordResetTokens();
        resets = new PasswordResetService(accountRepository, resetTokens, refreshTokens, tokens, tokens, mail, clock, "https://readora.test");
        teams = new InMemoryTeamRepository();
        readerData = new InMemoryReaderData();
        deletion = new AccountDeletionService(accountRepository, teams, readerData, refreshTokens, resetTokens, tokens, clock);
        readerExport = new InMemoryReaderExport();
        exports = new AccountExportService(accountRepository, readerExport, clock);
        devices.clear();
        accounts.clear();
        refusal = null;
    }

    @Given("{string} has an account with the password {string}")
    public void hasAnAccount(String reader, String password) {
        AuthResult registered = auth.register(email(reader), reader.toLowerCase(Locale.ROOT), password);
        accounts.put(reader, registered.account().getId());
        devices.put(reader + " first", registered.refreshToken());
    }

    @Given("{string} is signed in on two devices")
    public void isSignedInOnTwoDevices(String reader) {
        devices.put(reader + " second", auth.login(email(reader), "first-password").refreshToken());
    }

    @When("{string} changes the password from {string} to {string} on the first device")
    public void changesThePassword(String reader, String current, String next) {
        try {
            AuthResult result = auth.changePassword(accounts.get(reader), current, next);
            devices.put(reader + " first", result.refreshToken());
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    @Then("{string} can log in with {string} but not with {string}")
    public void canLogInWithButNotWith(String reader, String works, String refused) {
        auth.login(email(reader), works);
        assertThatThrownBy(() -> auth.login(email(reader), refused)).isInstanceOf(InvalidCredentialsException.class);
    }

    @Then("{string} can still log in with {string}")
    public void canStillLogInWith(String reader, String password) {
        auth.login(email(reader), password);
    }

    @Then("the {word} device of {string} is signed out")
    public void theDeviceIsSignedOut(String device, String reader) {
        assertThatThrownBy(() -> auth.refresh(devices.get(reader + " " + device))).isInstanceOf(InvalidCredentialsException.class);
    }

    @Then("the {word} device of {string} stays signed in")
    public void theDeviceStaysSignedIn(String device, String reader) {
        auth.refresh(devices.get(reader + " " + device));
    }

    @Then("the password change is refused with the error code {string}")
    public void thePasswordChangeIsRefused(String code) {
        assertThat(refusal).isInstanceOf(CodedException.class);
        assertThat(((CodedException) refusal).code()).isEqualTo(code);
    }

    private static String email(String reader) {
        return reader.toLowerCase(Locale.ROOT) + "@readora.test";
    }
    @When("someone asks for a password reset link for {string}")
    public void someoneAsksForALink(String email) {
        resets.requestReset(email, SiteLanguage.ENGLISH);
    }

    @Given("{string} asked for a password reset link")
    public void askedForALink(String reader) {
        resets.requestReset(email(reader), SiteLanguage.ENGLISH);
    }

    @Then("{string} receives an email with a link to choose a new password")
    public void receivesAnEmailWithALink(String reader) {
        assertThat(mail.sent()).singleElement().satisfies(sent -> {
            assertThat(sent.to()).isEqualTo(email(reader));
            assertThat(sent.text()).contains("https://readora.test/reset-password?token=");
        });
    }

    @Then("no email is sent")
    public void noEmailIsSent() {
        assertThat(mail.sent()).isEmpty();
    }

    @When("the link from the email sets the password {string}")
    @Given("the link from the email set the password {string}")
    public void theLinkSetsThePassword(String password) {
        try {
            resets.resetPassword(tokenOfTheLastEmail(), password);
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    @When("{int} minutes pass")
    public void minutesPass(int minutes) {
        clock.advance(Duration.ofMinutes(minutes));
    }

    @Then("the reset is refused with the error code {string}")
    public void theResetIsRefused(String code) {
        thePasswordChangeIsRefused(code);
    }

    private String tokenOfTheLastEmail() {
        Matcher link = Pattern.compile("reset-password\\?token=(\\S+)").matcher(mail.sent().getLast().text());
        assertThat(link.find()).isTrue();
        return link.group(1);
    }
    @Given("{string} commented on a chapter and keeps a series in the library")
    public void commentedAndKeepsASeries(String reader) {
        readerData.addComment(accounts.get(reader), reader.toLowerCase(Locale.ROOT), "What a chapter!");
        readerData.addReaderRow(accounts.get(reader), "library: Solo Leveling");
    }

    @Given("{string} leads the team {string} alone")
    public void leadsTheTeamAlone(String reader, String teamName) {
        teams.save(Team.create(teamName, null, accounts.get(reader)));
    }

    @When("{string} deletes the account with the password {string}")
    public void deletesTheAccount(String reader, String password) {
        try {
            deletion.deleteAccount(accounts.get(reader), password);
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    @Then("{string} can no longer log in with {string}")
    public void canNoLongerLogIn(String reader, String password) {
        assertThatThrownBy(() -> auth.login(email(reader), password)).isInstanceOf(InvalidCredentialsException.class);
    }

    @Then("everything that was only for {string} is erased")
    public void everythingIsErased(String reader) {
        assertThat(readerData.readerRowsOf(accounts.get(reader))).isEmpty();
        assertThat(accountRepository.findById(accounts.get(reader))).get().satisfies(account -> {
            assertThat(account.isDeleted()).isTrue();
            assertThat(account.getBio()).isEmpty();
            assertThat(account.getEmail().value()).endsWith("@deleted.invalid");
        });
    }

    @Then("the comments of {string} stay, signed by a deleted account")
    public void theCommentsStay(String reader) {
        String placeholder = accountRepository.findById(accounts.get(reader)).orElseThrow().getUsername();
        assertThat(placeholder).startsWith("deleted_");
        assertThat(readerData.authorOf("What a chapter!")).isEqualTo(placeholder);
    }

    @Then("the deletion is refused with the error code {string}")
    public void theDeletionIsRefused(String code) {
        thePasswordChangeIsRefused(code);
    }
    @Given("{string} keeps {string} in the library, commented {string} and rated {string} {int}")
    public void keepsCommentsAndRates(String reader, String series, String comment, String rated, int score) {
        readerExport.keep(accounts.get(reader), series, clock.instant());
        readerExport.comment(accounts.get(reader), series, comment, clock.instant());
        readerExport.rate(accounts.get(reader), rated, score, clock.instant());
    }

    @When("{string} downloads the account data")
    public void downloadsTheAccountData(String reader) {
        exported = exports.export(accounts.get(reader));
    }

    @Then("the file holds the account of {string} with its email")
    public void theFileHoldsTheAccount(String reader) {
        assertThat(exported.username()).isEqualTo(reader.toLowerCase(Locale.ROOT));
        assertThat(exported.email()).isEqualTo(email(reader));
    }

    @Then("the file lists {string} in the library, the comment {string} and the rating {int}")
    public void theFileListsTheData(String series, String comment, int score) {
        assertThat(exported.data().library()).extracting(ReaderData.LibraryItem::series).containsExactly(series);
        assertThat(exported.data().comments()).extracting(ReaderData.Comment::content).containsExactly(comment);
        assertThat(exported.data().ratings()).extracting(ReaderData.Rating::score).containsExactly(score);
    }
}
