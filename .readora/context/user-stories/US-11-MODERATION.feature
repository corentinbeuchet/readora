# From docs/use-cases (2026-09): UC-37 report queue, UC-38 anti-spam. Broken pages are reported in US-06.
# Priority tags: @must / @should / @could.

Feature: Keeping discussions healthy
  As a reader and as a moderator
  I want to report bad comments and have them handled quickly
  So that discussions stay friendly and spoiler-free

  Background:
    Given "Aoi" posted a comment on chapter 5 of "Solo Leveling"
    And "Mina" is a moderator

  # Inspired by: MangaDex, Reddit
  @must
  Scenario: Reporting a comment
    When "Kenji" reports the comment of "Aoi" as "Unmarked spoiler"
    Then "Mina" sees the report in the moderation queue

  @must
  Scenario: A moderator hides a comment
    Given "Kenji" reported the comment of "Aoi" as "Harassment"
    When "Mina" hides the comment
    Then readers no longer see it
    And the report is closed

  @should
  Scenario: A moderator dismisses a report
    Given "Kenji" reported the comment of "Aoi" as "Spam"
    When "Mina" dismisses the report
    Then the comment stays visible
    And the report is closed

  @must
  Scenario: Only moderators see the reports
    Given "Kenji" reported the comment of "Aoi" as "Spam"
    When reader "Aoi" opens the moderation queue
    Then access is refused

  # Anti-spam: a person can't flood a chapter.
  @should
  Scenario: Commenting too fast
    Given "Kenji" posted a comment a few seconds ago
    When he posts another comment right away
    Then he is asked to wait a few seconds before commenting again

  # A new team's first chapter is checked by a moderator before readers see it (MangaDex reviews a group's first
  # upload); once a team has a published chapter, the next ones go out straight away. COMMENT_MODERATE covers it.
  @must
  Scenario: A new team's first chapter waits for a moderator
    When the new team "Nova Scans" publishes chapter 1 of "Omniscient Reader"
    Then readers do not see chapter 1 of "Omniscient Reader"
    And "Mina" sees chapter 1 of "Omniscient Reader" by "Nova Scans" waiting for review

  @must
  Scenario: A moderator approves a first chapter
    Given "Kenji" keeps "Omniscient Reader" in his library
    And the new team "Nova Scans" published chapter 1 of "Omniscient Reader" for review
    When "Mina" approves the chapter
    Then readers see chapter 1 of "Omniscient Reader"
    And "Kenji" hears "Omniscient Reader: chapter 1 is out"

  @should
  Scenario: A moderator sends a first chapter back
    Given the new team "Nova Scans" published chapter 1 of "Omniscient Reader" for review
    When "Mina" sends the chapter back
    Then readers do not see chapter 1 of "Omniscient Reader"
    And the leader of "Nova Scans" hears "Omniscient Reader: chapter 1 was not approved. Check its pages, then publish it again."
    And "Nova Scans" can publish chapter 1 of "Omniscient Reader" again for review

  @must
  Scenario: A team with a published chapter publishes straight away
    Given the new team "Nova Scans" published chapter 1 of "Omniscient Reader" for review
    And "Mina" approved the chapter
    When "Nova Scans" publishes chapter 2 of "Omniscient Reader"
    Then readers see chapter 2 of "Omniscient Reader"

  @must
  Scenario: Only moderators review chapters
    Given the new team "Nova Scans" published chapter 1 of "Omniscient Reader" for review
    When reader "Aoi" tries to approve the chapter
    Then access is refused
