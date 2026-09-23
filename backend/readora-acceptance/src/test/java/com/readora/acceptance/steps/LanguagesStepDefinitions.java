package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryRatingRepository;
import com.readora.acceptance.fakes.InMemoryUserAccounts;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.application.port.out.PasswordHasherPort;
import com.readora.application.port.out.RefreshTokenRepositoryPort;
import com.readora.application.port.out.TokenProviderPort;
import com.readora.application.service.AuthenticationService;
import com.readora.application.service.RatingService;
import com.readora.domain.common.CodedException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.work.WorkId;
import io.cucumber.java.Before;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.jspecify.annotations.Nullable;

import java.lang.reflect.Proxy;
import java.time.Clock;

import static org.assertj.core.api.Assertions.assertThat;

/// US-13 Reading Readora in my language: the backend side, stable error codes the frontend translates.
public class LanguagesStepDefinitions {

    private static final String EMAIL = "camille@readora.test";

    private AuthenticationService auth;
    private RatingService ratings;
    private @Nullable RuntimeException refusal;

    @Before
    public void setup() {
        InMemoryUserAccounts accounts = new InMemoryUserAccounts();
        PasswordHasherPort hasher = new PasswordHasherPort() {
            @Override
            public PasswordHash hash(String rawPassword) {
                return PasswordHash.of("hashed:" + rawPassword);
            }

            @Override
            public boolean matches(String rawPassword, PasswordHash hash) {
                return hash.equals(hash(rawPassword));
            }
        };
        accounts.save(UserAccount.register(Email.of(EMAIL), "camille", hasher.hash("right-password")));
        // A refused login never issues tokens, so these ports must not be reached.
        auth = new AuthenticationService(accounts, unused(RefreshTokenRepositoryPort.class), hasher,
                unused(TokenProviderPort.class));
        ratings = new RatingService(new InMemoryRatingRepository(), new InMemoryWorkRepository(), Clock.systemUTC());
        refusal = null;
    }

    @When("a visitor logs in with a wrong password")
    public void aVisitorLogsInWithAWrongPassword() {
        refusal = attempt(() -> auth.login(EMAIL, "wrong-password"));
    }

    @When("reader {string} rates a series that does not exist")
    public void readerRatesASeriesThatDoesNotExist(String reader) {
        refusal = attempt(() -> ratings.rate(UserId.of(reader), WorkId.generate(), 8));
    }

    @Then("the request is refused with the error code {string}")
    public void theRequestIsRefusedWithTheErrorCode(String code) {
        assertThat(refusal).isInstanceOf(CodedException.class);
        assertThat(((CodedException) refusal).code()).isEqualTo(code);
    }

    private static @Nullable RuntimeException attempt(Runnable action) {
        try {
            action.run();
            return null;
        } catch (RuntimeException e) {
            return e;
        }
    }

    private static <T> T unused(Class<T> port) {
        return port.cast(Proxy.newProxyInstance(port.getClassLoader(), new Class<?>[]{port}, (proxy, method, args) -> {
            throw new UnsupportedOperationException(port.getSimpleName() + "." + method.getName() + " is not used here");
        }));
    }
}
