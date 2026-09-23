# Rewritten 2026-09 from the first draft ("curated public collections"): readers first need a personal library
# (it also feeds the "new chapters" badge of US-07). Public lists are a @could.
# The library and exact-page progress sync (US-01) are free for every signed-in reader.

Feature: My library
  As a reader
  I want to keep the series I follow in one place, each with a reading status
  So that I always know what to read next

  Background:
    Given reader "Kenji" has a free account
    And the series "Solo Leveling" and "Omniscient Reader" are in the catalog

  Scenario: Adding a series to my library
    When "Kenji" adds "Solo Leveling" to his library
    Then his library shows "Solo Leveling" as "Reading"

  Scenario: Planning to read a series
    When "Kenji" adds "Omniscient Reader" to his library as "Plan to read"
    Then his library shows "Omniscient Reader" as "Plan to read"

  Scenario: Filtering my library by status
    Given "Kenji" is reading "Solo Leveling" and plans to read "Omniscient Reader"
    When he shows only "Plan to read"
    Then he sees only "Omniscient Reader"

  Scenario: Marking a series as completed
    Given "Kenji" has "Solo Leveling" in his library
    When he marks "Solo Leveling" as "Completed"
    Then his library shows "Solo Leveling" as "Completed"

  Scenario: Removing a series
    Given "Kenji" has "Solo Leveling" in his library
    When he removes "Solo Leveling" from his library
    Then his library is empty

  Scenario: My library is private
    Given "Kenji" has "Solo Leveling" in his library
    Then the library of reader "Aoi" is empty

  @could
  Scenario: Sharing a public list
    When "Kenji" publishes the list "Peak Webtoons" with "Solo Leveling" and "Omniscient Reader"
    Then other readers can see and upvote "Peak Webtoons"
