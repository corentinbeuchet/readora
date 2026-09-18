# From docs/use-cases (2026-09): UC-37 report queue, UC-38 anti-spam. Broken pages are reported in US-06.
# Priority tags: @must / @should / @could. @wip = not built yet (feature level: nothing here is built).

@wip
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
