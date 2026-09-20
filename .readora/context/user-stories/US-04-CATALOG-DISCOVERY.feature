# Rewritten 2026-09 from the first draft: ratings dropped (no rating system yet), author and demographic added to works.
# @ui = frontend-only, verified by a Vitest test named after the scenario (not run by Cucumber).

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

  # A series is often known by its original or romanised title: the search finds it by any of its other titles too.
  @should
  Scenario: Searching by another title of the series
    Given "Solo Leveling" is also known as "Na Honjaman Level Up"
    When a reader types "honjaman" in the search box
    Then the suggestions show "Solo Leveling" by "Chugong"

  @ui
  Scenario: Clicking a genre cycles between wanted, excluded and ignored
    When a reader clicks the "Action" genre once
    Then "Action" is marked as wanted
    When he clicks it again
    Then "Action" is marked as excluded
    When he clicks it a third time
    Then "Action" is no longer used as a filter

  # Series facts (decided 2026-09-20; seen on the series pages of comix.to and MangaDex): other titles, artist, year,
  # original language and content rating. All optional: a fact nobody filled in is simply not shown.
  @should
  Scenario: A team leader fills in the facts of a series
    Given scanlator "Mina" leads a team that translates "Solo Leveling"
    When "Mina" sets the facts of "Solo Leveling" to artist "DUBU", year 2018, language "KOREAN", rating "TEEN" and other title "Na Honjaman Level Up"
    Then "Solo Leveling" has artist "DUBU", year 2018, language "KOREAN", rating "TEEN" and other title "Na Honjaman Level Up"

  @should
  Scenario: Only the leaders of a team of the series can edit it
    Given scanlator "Mina" leads a team that translates "Solo Leveling"
    And scanlator "Tom" leads a team that translates "Berserk"
    And "Aoi" is a translator of the team of "Mina"
    When "Tom" sets the artist of "Solo Leveling" to "Nobody"
    Then the edit is refused to "Tom"
    When "Aoi" sets the artist of "Solo Leveling" to "Nobody"
    Then the edit is refused to "Aoi"
    And "Solo Leveling" has no artist

  @could
  Scenario: A series has at most ten other titles
    Given scanlator "Mina" leads a team that translates "Solo Leveling"
    When "Mina" gives "Solo Leveling" 11 other titles
    Then the edit is refused because a series has at most 10 other titles

  @should @ui
  Scenario: Series facts on the series page
    Given "Solo Leveling" has the artist "DUBU", the year 2018, the language Korean and the other title "Na Honjaman Level Up"
    And nobody filled in its content rating
    When a reader opens the series "Solo Leveling"
    Then the page lists the artist, the year, the language and the other title
    And no content rating is shown

  @should @ui
  Scenario: A team leader edits the series from the team workspace
    Given "Mina" leads a team that translates "Solo Leveling"
    When she opens "Edit series" for "Solo Leveling" in her team workspace and saves the artist "DUBU"
    Then the series is saved with the artist "DUBU" and she is back on the series page
