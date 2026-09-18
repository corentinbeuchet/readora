# Rewritten 2026-09 from the first draft: ratings dropped (no rating system yet), author and demographic added to works.
# @ui = frontend-only, verified by a Vitest test named after the scenario (not run by Cucumber).

@wip
Feature: Finding a series in the catalog
  As a reader
  I want to search the catalog and filter it by genre, type, status and audience
  So that I quickly find series I will like

  Background:
    Given the catalog has these series:
      | title             | type   | status    | demographic | author        | genres                         |
      | Solo Leveling     | MANHWA | COMPLETED | SHOUNEN     | Chugong       | Action, Fantasy                |
      | Omniscient Reader | MANHWA | ONGOING   | SHOUNEN     | Sing Shong    | Action, Fantasy, Apocalypse    |
      | Horimiya          | MANGA  | COMPLETED | SHOUNEN     | HERO          | Romance, Comedy, Slice of Life |
      | Berserk           | MANGA  | HIATUS    | SEINEN      | Kentaro Miura | Action, Dark Fantasy, Horror   |

  Scenario: Wanting a genre and excluding another
    When a reader wants "Action" but not "Romance"
    Then the results are "Solo Leveling", "Omniscient Reader" and "Berserk"

  Scenario: Wanting two genres at once
    When a reader wants "Action" and "Fantasy"
    Then the results are "Solo Leveling" and "Omniscient Reader"

  Scenario: Filtering by type and status
    When a reader filters on type "MANHWA" and status "COMPLETED"
    Then the results are "Solo Leveling"

  Scenario: Filtering by audience
    When a reader filters on demographic "SEINEN"
    Then the results are "Berserk"

  Scenario: Instant search on part of a title
    When a reader types "omni" in the search box
    Then the suggestions show "Omniscient Reader" by "Sing Shong"

  Scenario: Searching by author
    When a reader types "miura" in the search box
    Then the suggestions show "Berserk" by "Kentaro Miura"

  @ui
  Scenario: Clicking a genre cycles between wanted, excluded and ignored
    When a reader clicks the "Action" genre once
    Then "Action" is marked as wanted
    When he clicks it again
    Then "Action" is marked as excluded
    When he clicks it a third time
    Then "Action" is no longer used as a filter
