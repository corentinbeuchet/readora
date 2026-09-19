# From docs/use-cases (2026-09): UC-25 profiles, UC-26 follows, UC-30 team pages, UC-31 chapter versions,
# UC-19 library export. Nice-to-haves, all @could.
# @wip = not built yet: several teams' versions of one chapter needs chapters unique per team rather than per number
# (publishing, reading history, next/previous chapter and the reader all assume one chapter per number).

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
    Then they see its members, the series it translates and its latest chapters

  # Inspired by: MangaDex
  @could @wip
  Scenario: Several teams translated the same chapter
    Given "Shadow Scans" and "Moon Scans" both published chapter 5 of "Solo Leveling"
    When "Kenji" opens chapter 5
    Then he can switch between the two versions
    And his choice is kept for the next chapters

  # Avoids lock-in (import from MyAnimeList needs their permission, so only export here).
  @could
  Scenario: Exporting my library
    When "Kenji" exports his library
    Then he downloads a file listing each series with its status and last chapter read
