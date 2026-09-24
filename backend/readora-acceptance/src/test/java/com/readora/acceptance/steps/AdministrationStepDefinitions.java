package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.FakeTokens;
import com.readora.acceptance.fakes.InMemoryRefreshTokens;
import com.readora.acceptance.fakes.InMemoryUserAccounts;
import com.readora.acceptance.fakes.MutableClock;
import com.readora.application.service.AccountAdministrationService;
import com.readora.application.service.AuthenticationService;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.CodedException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.InvalidCredentialsException;
import com.readora.domain.identity.Permission;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.UserAccount;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.jspecify.annotations.Nullable;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/// US-16 Looking after accounts, through the real `AccountAdministrationService` and `AuthenticationService` (login and
/// refresh check the account's standing) over in-memory accounts and sessions, on a clock the scenario moves.
public class AdministrationStepDefinitions {

    private static final String PASSWORD = "readora-password";

    private AuthenticationService auth;
    private AccountAdministrationService administration;
    private InMemoryUserAccounts accounts;
    private MutableClock clock;
    private final Map<String, UserId> ids = new HashMap<>();
    private final Map<String, String> sessions = new HashMap<>();
    private List<UserAccount> found = List.of();
    private @Nullable RuntimeException refusal;

    @Before
    public void setup() {
        FakeTokens tokens = new FakeTokens();
        accounts = new InMemoryUserAccounts();
        InMemoryRefreshTokens refreshTokens = new InMemoryRefreshTokens();
        clock = new MutableClock(Instant.now());
        auth = new AuthenticationService(accounts, refreshTokens, tokens, tokens, Duration.ofSeconds(30), clock);
        administration = new AccountAdministrationService(accounts, refreshTokens, clock);
        ids.clear();
        sessions.clear();
        found = List.of();
        refusal = null;
    }

    @Given("{string} is an admin")
    public void isAnAdmin(String name) {
        UserAccount account = accounts.findById(register(name)).orElseThrow();
        account.grantRole(Role.ADMIN);
        accounts.save(account);
    }

    @Given("{string} has a reader account")
    public void hasAReaderAccount(String name) {
        register(name);
    }

    @Given("{string} has an open session")
    public void hasAnOpenSession(String name) {
        sessions.put(name, auth.login(email(name), PASSWORD).refreshToken());
    }

    @When("{string} looks for accounts starting with {string}")
    public void looksForAccounts(String admin, String query) {
        found = administration.search(ids.get(admin), query);
    }

    @Then("the account of {string} is found with the role {string}")
    public void theAccountIsFound(String name, String role) {
        assertThat(found).singleElement().satisfies(account -> {
            assertThat(account.getId()).isEqualTo(ids.get(name));
            assertThat(account.getRoles()).containsExactly(Role.valueOf(role));
        });
    }

    @When("{string} gives {string} the role {string}")
    public void givesTheRole(String admin, String name, String role) {
        attempt(() -> administration.assignRole(ids.get(admin), ids.get(name), Role.valueOf(role)));
    }

    @Then("{string} can moderate comments")
    public void canModerateComments(String name) {
        assertThat(accounts.findById(ids.get(name)).orElseThrow().can(Permission.COMMENT_MODERATE)).isTrue();
    }

    @When("{string} suspends {string} for {int} days")
    public void suspends(String admin, String name, int days) {
        administration.suspend(ids.get(admin), ids.get(name), days);
    }

    @When("{string} bans {string}")
    public void bans(String admin, String name) {
        administration.ban(ids.get(admin), ids.get(name));
    }

    @When("{string} reinstates {string}")
    public void reinstates(String admin, String name) {
        administration.reinstate(ids.get(admin), ids.get(name));
    }

    @When("{string} tries to ban {string}")
    public void triesToBan(String actor, String name) {
        attempt(() -> administration.ban(ids.get(actor), ids.get(name)));
    }

    @When("{int} days pass")
    public void daysPass(int days) {
        clock.advance(Duration.ofDays(days));
    }

    @Then("the session of {string} is over")
    public void theSessionIsOver(String name) {
        assertThatThrownBy(() -> auth.refresh(sessions.get(name))).isInstanceOf(InvalidCredentialsException.class);
    }

    @Then("{string} cannot log in, with the error code {string}")
    public void cannotLogIn(String name, String code) {
        assertThatThrownBy(() -> auth.login(email(name), PASSWORD))
                .isInstanceOfSatisfying(AccessDeniedDomainException.class, e -> assertThat(e.code()).isEqualTo(code));
    }

    @Then("{string} can log in again")
    public void canLogInAgain(String name) {
        auth.login(email(name), PASSWORD);
    }

    @Then("the ban is refused")
    public void theBanIsRefused() {
        assertThat(refusal).isInstanceOf(AccessDeniedDomainException.class);
    }

    @Then("the change is refused with the error code {string}")
    public void theChangeIsRefused(String code) {
        assertThat(refusal).isInstanceOf(CodedException.class);
        assertThat(((CodedException) refusal).code()).isEqualTo(code);
    }

    private UserId register(String name) {
        UserId id = auth.register(email(name), name.toLowerCase(Locale.ROOT), PASSWORD).account().getId();
        ids.put(name, id);
        return id;
    }

    private void attempt(Runnable action) {
        try {
            action.run();
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    private static String email(String name) {
        return name.toLowerCase(Locale.ROOT) + "@readora.test";
    }
}
