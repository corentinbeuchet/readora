package com.readora.web.controller;

import com.readora.domain.common.UserId;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.UserAccount;
import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-04 series facts through real HTTP, real auth and the real database (Flyway `V21`): what a series page gets,
/// and who may replace the description of a series.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkFactsIntegrationTest extends AuthTestSupport {

    private static final String SOLO_LEVELING_FACTS = """
            {"alternativeTitles":["Na Honjaman Level Up","  ","na honjaman level up"],"artist":" DUBU ","releaseYear":2018,
             "originalLanguage":"KOREAN","contentRating":"TEEN"}""";

    @Test
    @DisplayName("A new series has no facts until someone fills them in; they can also be given when it is created")
    void aSeriesStartsWithoutFacts() throws Exception {
        Session mina = register();

        String bare = givenASeriesCreatedBy(mina, null);
        String described = givenASeriesCreatedBy(mina, SOLO_LEVELING_FACTS);

        thenTheSeriesHasNoFacts(bare);
        thenTheSeriesHasTheSoloLevelingFacts(described);
    }

    @Test
    @DisplayName("A leader of a team of the series replaces its description; everyone then reads the facts, normalised")
    void aTeamLeaderEditsTheSeries() throws Exception {
        Session mina = register();
        String workId = givenASeriesCreatedBy(mina, null);

        whenTheSeriesIsDescribed(mina, workId, description("Solo Leveling", SOLO_LEVELING_FACTS))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Solo Leveling"))
                .andExpect(jsonPath("$.data.facts.artist").value("DUBU"));

        thenTheSeriesHasTheSoloLevelingFacts(workId);
    }

    @Test
    @DisplayName("Editing again replaces the facts: titles left out are removed, their order is the one sent")
    void anEditReplacesTheFacts() throws Exception {
        Session mina = register();
        String workId = givenASeriesCreatedBy(mina, SOLO_LEVELING_FACTS);

        whenTheSeriesIsDescribed(mina, workId, description("Solo Leveling", "{\"alternativeTitles\":[\"Only I Level Up\",\"Solo\"]}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/works/" + workId))
                .andExpect(jsonPath("$.data.facts.alternativeTitles.length()").value(2))
                .andExpect(jsonPath("$.data.facts.alternativeTitles[0]").value("Only I Level Up"))
                .andExpect(jsonPath("$.data.facts.alternativeTitles[1]").value("Solo"))
                .andExpect(jsonPath("$.data.facts.artist").doesNotExist())
                .andExpect(jsonPath("$.data.facts.releaseYear").doesNotExist());
    }

    @Test
    @DisplayName("Guests, readers, scanlators of other teams and non-leader members cannot edit a series; an admin can")
    void onlyLeadersOfTheSeriesOrAdminsEdit() throws Exception {
        Session mina = register();
        String workId = givenASeriesCreatedBy(mina, null);
        Session tom = register();
        Session aoi = register();
        givenAMemberOfTheTeamOf(mina, workId, aoi, "TRANSLATOR");
        String hijack = description("Hijacked", "{}");

        mockMvc.perform(put("/api/v1/works/" + workId).contentType(MediaType.APPLICATION_JSON).content(hijack))
                .andExpect(status().isUnauthorized());
        whenTheSeriesIsDescribed(register(), workId, hijack).andExpect(status().isForbidden());
        whenTheSeriesIsDescribed(tom, workId, hijack)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        whenTheSeriesIsDescribed(aoi, workId, hijack).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/works/" + workId)).andExpect(jsonPath("$.data.title").value(org.hamcrest.Matchers.startsWith("Series ")));

        whenTheSeriesIsDescribed(registerAdmin(), workId, description("Fixed by an admin", "{}")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/works/" + workId)).andExpect(jsonPath("$.data.title").value("Fixed by an admin"));
    }

    @Test
    @DisplayName("The body never says who edits: an editorId in it is ignored, the JWT decides")
    void theEditorComesFromTheToken() throws Exception {
        Session mina = register();
        String workId = givenASeriesCreatedBy(mina, null);
        Session tom = register();
        String forged = description("Hijacked", "{}").replaceFirst("\\{", "{\"editorId\":\"" + mina.userId() + "\",\"userId\":\"" + mina.userId() + "\",");

        whenTheSeriesIsDescribed(tom, workId, forged).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Facts out of bounds are refused with 400: 11 titles, a year before 1900, an unknown language")
    void factsOutOfBoundsAreRefused() throws Exception {
        Session mina = register();
        String workId = givenASeriesCreatedBy(mina, null);
        String elevenTitles = "{\"alternativeTitles\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\",\"11\"]}";

        whenTheSeriesIsDescribed(mina, workId, description("Solo Leveling", elevenTitles)).andExpect(status().isBadRequest());
        whenTheSeriesIsDescribed(mina, workId, description("Solo Leveling", "{\"releaseYear\":1899}")).andExpect(status().isBadRequest());
        whenTheSeriesIsDescribed(mina, workId, description("Solo Leveling", "{\"originalLanguage\":\"KLINGON\"}")).andExpect(status().isBadRequest());
        whenTheSeriesIsDescribed(mina, workId, description("", "{}")).andExpect(status().isBadRequest());

        thenTheSeriesHasNoFacts(workId);
    }

    @Test
    @DisplayName("Editing a series that does not exist answers 404")
    void anUnknownSeriesIsNotFound() throws Exception {
        whenTheSeriesIsDescribed(register(), UUID.randomUUID().toString(), description("Ghost", "{}")).andExpect(status().isNotFound());
    }

    private String givenASeriesCreatedBy(Session scanlator, String facts) throws Exception {
        String body = "{\"title\":\"Series " + UUID.randomUUID() + "\",\"type\":\"MANHWA\"" + (facts != null ? ",\"facts\":" + facts : "") + "}";
        var created = mockMvc.perform(post("/api/v1/works").header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return json(created).path("data").path("id").asString();
    }

    private void givenAMemberOfTheTeamOf(Session leader, String workId, Session member, String role) throws Exception {
        mockMvc.perform(put("/api/v1/teams/" + teamOf(leader, workId) + "/members/" + member.username()).header("Authorization", leader.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[\"" + role + "\"]}"))
                .andExpect(status().isOk());
    }

    private Session registerAdmin() throws Exception {
        Session reader = register();
        UserAccount account = userAccountRepository.findById(UserId.of(reader.userId())).orElseThrow();
        account.grantRole(Role.ADMIN);
        userAccountRepository.save(account);
        return login(reader.email());
    }

    private ResultActions whenTheSeriesIsDescribed(Session editor, String workId, String description) throws Exception {
        return mockMvc.perform(put("/api/v1/works/" + workId).header("Authorization", editor.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(description));
    }

    private void thenTheSeriesHasNoFacts(String workId) throws Exception {
        mockMvc.perform(get("/api/v1/works/" + workId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facts.alternativeTitles.length()").value(0))
                .andExpect(jsonPath("$.data.facts.artist").doesNotExist())
                .andExpect(jsonPath("$.data.facts.releaseYear").doesNotExist())
                .andExpect(jsonPath("$.data.facts.originalLanguage").doesNotExist())
                .andExpect(jsonPath("$.data.facts.contentRating").doesNotExist());
    }

    private void thenTheSeriesHasTheSoloLevelingFacts(String workId) throws Exception {
        mockMvc.perform(get("/api/v1/works/" + workId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facts.alternativeTitles.length()").value(1))
                .andExpect(jsonPath("$.data.facts.alternativeTitles[0]").value("Na Honjaman Level Up"))
                .andExpect(jsonPath("$.data.facts.artist").value("DUBU"))
                .andExpect(jsonPath("$.data.facts.releaseYear").value(2018))
                .andExpect(jsonPath("$.data.facts.originalLanguage").value("KOREAN"))
                .andExpect(jsonPath("$.data.facts.contentRating").value("TEEN"));
    }

    private static String description(String title, String facts) {
        return "{\"title\":\"" + title + "\",\"synopsis\":\"A hunter levels up.\",\"type\":\"MANHWA\",\"status\":\"ONGOING\",\"facts\":" + facts + "}";
    }
}
