# From docs/use-cases (2026-09): UC-25 profiles, UC-26 follows, UC-30 team pages, UC-31 chapter versions,
# UC-19 library export. Nice-to-haves, all @could.
# A chapter number can exist in several teams' versions: reading any version counts as reading the chapter, and
# next/previous stay with the same team when it has the chapter (lesson from MangaDex, where the reader jumps groups).

Feature: Community and scanlation teams
  As a reader
  I want to see who reads and translates what
  So that I can follow the people and teams I like

  # Inspired by: AniList profiles
  @could
  Scenario: A public profile with reading stats
    Given "Kenji" read 120 chapters, mostly "Action" and "Fantasy"
    When "Aoi" opens the profile of "Kenji"
    Then she sees his chapters read, his favourite genres and his completed series

  # Inspired by: MangaDex groups
  @could
  Scenario: Following a scanlation team
    When "Kenji" follows the team "Shadow Scans"
    And "Shadow Scans" publishes a chapter
    Then the chapter appears in his "Latest updates" feed

  @could
  Scenario: A team page
    When a reader opens the page of the team "Shadow Scans"
    Then they see its members, every series it translates and its latest chapters

  @could @ui
  Scenario: The team page lists every series as a card
    Given the team "Shadow Scans" translates "Solo Leveling" and "Omniscient Reader"
    When a reader opens the page of the team "Shadow Scans"
    Then each series is a card with the number of chapters the team published

  # Inspired by: comix.to and MangaDex chapter lists. One row per chapter number, the teams inside (decided 2026-09-20):
  # read marks and "Next up" are per number, so a flat list of versions would show one chapter as read and unread.
  @should @ui
  Scenario: Each chapter of a series names the team that translated it
    Given "Shadow Scans" published chapter 5 of "Solo Leveling"
    When a reader opens the series "Solo Leveling"
    Then the row of chapter 5 names the team "Shadow Scans"

  @should @ui
  Scenario: One row per chapter number with its versions
    Given "Shadow Scans" and "Moon Scans" both published chapter 5 of "Solo Leveling"
    When a reader opens the series "Solo Leveling"
    Then chapter 5 appears once, by "Shadow Scans", with a link to the version by "Moon Scans"

  @should @ui
  Scenario: Filtering the chapter list by team
    Given "Shadow Scans" published chapters 5 and 6 of "Solo Leveling" and "Moon Scans" only chapter 5
    When a reader filters the chapters by "Moon Scans"
    Then only chapter 5 is listed, in the version by "Moon Scans"

  @could @ui
  Scenario: Sorting chapters newest or oldest first
    When a reader chooses "Newest first" on the series "Solo Leveling"
    Then the last chapter comes first

  @should @ui
  Scenario: Translated by lists each team
    Given "Shadow Scans" published 2 chapters of "Solo Leveling" and "Moon Scans" 1
    When a reader opens the series "Solo Leveling"
    Then "Translated by" lists "Shadow Scans" with 2 chapters and "Moon Scans" with 1 chapter, each linking to its team page

  # The reader's choice of team lives in the browser (guests too); the server already stays with the team being read.
  @should @ui
  Scenario: Switching version in the reader keeps my team for the next chapters
    Given "Kenji" reads chapter 5 of "Solo Leveling" by "Shadow Scans"
    When he switches to the version by "Moon Scans"
    Then "Next chapter" opens chapter 6 by "Moon Scans"

  @should @ui
  Scenario: The series page opens the chapters in the versions by my team
    Given "Kenji" prefers "Moon Scans" for "Solo Leveling"
    And "Shadow Scans" and "Moon Scans" both published chapter 5 of "Solo Leveling"
    When he opens the series "Solo Leveling"
    Then chapter 5 opens in the version by "Moon Scans", with a link to the version by "Shadow Scans"

  @should @ui
  Scenario: The next chapter falls back when my team has not released it
    Given "Kenji" prefers "Moon Scans" for "Solo Leveling" and only "Shadow Scans" published chapter 6
    When he reaches the end of chapter 5
    Then "Next chapter" opens chapter 6 by "Shadow Scans"

  @should
  Scenario: A team only publishes into a series it works on
    Given "Solo Leveling" is already translated by the team "Shadow Scans"
    And scanlator "Mina" leads the team "Moon Scans"
    When "Mina" publishes chapter 9 of "Solo Leveling" for "Moon Scans"
    Then the chapter is refused because "Moon Scans" does not work on the series
    When "Mina" adds the series "Solo Leveling" to "Moon Scans"
    And "Mina" publishes chapter 9 of "Solo Leveling" for "Moon Scans"
    Then chapter 9 of "Solo Leveling" is credited to "Moon Scans"

  # Inspired by: MangaDex groups (anyone who uploads can start a group; a group works on many titles)
  @should
  Scenario: A scanlator creates a team
    When scanlator "Mina" creates the team "Moon Scans"
    Then "Mina" is the leader of "Moon Scans"
    And the page of the team "Moon Scans" lists no series yet

  @should
  Scenario: A team name is taken only once
    Given scanlator "Mina" leads the team "Moon Scans"
    When scanlator "Ravi" creates the team "moon scans"
    Then the team is refused because the name is taken

  @should
  Scenario: A team leader adds an existing series to their team
    Given "Solo Leveling" is already translated by the team "Shadow Scans"
    And scanlator "Mina" leads the team "Moon Scans"
    When "Mina" adds the series "Solo Leveling" to "Moon Scans"
    Then "Moon Scans" has its own task board for "Solo Leveling"
    And the page of the team "Moon Scans" lists the series "Solo Leveling"

  # The upload studio starts from the catalog, so a series is not created twice and a team knows it adds its own
  # version of a series that other teams may already translate.
  @should @ui
  Scenario: Uploading starts by finding the series
    Given "Solo Leveling" is in the catalog
    When scanlator "Mina" opens the upload studio and searches for "solo"
    Then she sees "Solo Leveling" among the results
    And she can choose to create a new series instead

  @should @ui
  Scenario: A leader publishes a chapter of a series already in the catalog
    Given "Solo Leveling" is already translated by the team "Shadow Scans"
    And scanlator "Mina" leads the team "Moon Scans"
    When "Mina" picks "Solo Leveling" in the upload studio for "Moon Scans"
    Then "Solo Leveling" is added to "Moon Scans"
    And she publishes the chapter into "Solo Leveling" as the version of "Moon Scans"

  @should @ui
  Scenario: A similar title is flagged before creating a series
    Given "Solo Leveling" is in the catalog
    When scanlator "Mina" types the title "Solo Leveling" for a new series
    Then she is told Readora already has "Solo Leveling"

  @should @ui
  Scenario: The upload shows the other teams' versions of the chapter
    Given "Shadow Scans" published chapter 5 of "Solo Leveling"
    And scanlator "Mina" leads the team "Moon Scans", which works on "Solo Leveling"
    When "Mina" sets up chapter 5 of "Solo Leveling" in the upload studio
    Then she is told she adds the version of "Moon Scans"
    And that "Shadow Scans" already published chapter 5

  @should
  Scenario: Only a leader can add a series or a member
    Given scanlator "Mina" leads the team "Moon Scans"
    And "Mina" added "Bob" to "Moon Scans" as "TRANSLATOR"
    When "Bob" tries to add the series "Solo Leveling" to "Moon Scans"
    Then the team refuses what "Bob" asked
    When "Bob" tries to add "Aoi" to "Moon Scans" as "PROOFREADER"
    Then the team refuses what "Bob" asked

  @should
  Scenario: A team always keeps a leader
    Given scanlator "Mina" leads the team "Moon Scans"
    When "Mina" tries to leave "Moon Scans"
    Then the team refuses because it would have no leader

  # Inspired by: MangaDex
  @could
  Scenario: Several teams translated the same chapter
    Given "Shadow Scans" and "Moon Scans" both published chapters 5 and 6 of "Solo Leveling"
    When "Kenji" opens chapter 5 by "Moon Scans"
    Then he can switch to the version by "Shadow Scans"
    And the next chapter is chapter 6 by "Moon Scans"

  @could
  Scenario: The next chapter falls back to another team
    Given "Shadow Scans" and "Moon Scans" both published chapters 5 and 6 of "Solo Leveling"
    And only "Shadow Scans" published chapter 7 of "Solo Leveling"
    When "Kenji" opens chapter 6 by "Moon Scans"
    Then the next chapter is chapter 7 by "Shadow Scans"

  @could
  Scenario: A team cannot publish the same chapter twice
    Given "Shadow Scans" and "Moon Scans" both published chapters 5 and 6 of "Solo Leveling"
    When "Moon Scans" publishes chapter 5 of "Solo Leveling" again
    Then the chapter is refused because the team already published it

  # Avoids lock-in (import from MyAnimeList needs their permission, so only export here).
  @could
  Scenario: Exporting my library
    When "Kenji" exports his library
    Then he downloads a file listing each series with its status and last chapter read
