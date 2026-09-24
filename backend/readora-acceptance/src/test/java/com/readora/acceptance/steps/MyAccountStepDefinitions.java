package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.FakeTokens;
import com.readora.acceptance.fakes.InMemoryRefreshTokens;
import com.readora.acceptance.fakes.InMemoryUserAccounts;
import com.readora.application.port.in.AuthenticateUserUseCase.AuthResult;
import com.readora.application.service.AuthenticationService;
import com.readora.domain.common.CodedException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.InvalidCredentialsException;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.jspecify.annotations.Nullable;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/// US-15 My account, through the real `AuthenticationService` over in-memory accounts and refresh tokens.
public class MyAccountStepDefinitions {

    private AuthenticationService auth;
    /// The refresh token of each signed-in device, by "<reader> <device>".
    private final Map<String, String> devices = new HashMap<>();
    private final Map<String, UserId> accounts = new HashMap<>();
    private @Nullable RuntimeException refusal;

    @Before
    public void setup() {
        FakeTokens tokens = new FakeTokens();
        auth = new AuthenticationService(new InMemoryUserAccounts(), new InMemoryRefreshTokens(), tokens, tokens);
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

    @Then("the second device of {string} is signed out")
    public void theSecondDeviceIsSignedOut(String reader) {
        assertThatThrownBy(() -> auth.refresh(devices.get(reader + " second"))).isInstanceOf(InvalidCredentialsException.class);
    }

    @Then("the first device of {string} stays signed in")
    public void theFirstDeviceStaysSignedIn(String reader) {
        auth.refresh(devices.get(reader + " first"));
    }

    @Then("the password change is refused with the error code {string}")
    public void thePasswordChangeIsRefused(String code) {
        assertThat(refusal).isInstanceOf(CodedException.class);
        assertThat(((CodedException) refusal).code()).isEqualTo(code);
    }

    private static String email(String reader) {
        return reader.toLowerCase(Locale.ROOT) + "@readora.test";
    }
}
