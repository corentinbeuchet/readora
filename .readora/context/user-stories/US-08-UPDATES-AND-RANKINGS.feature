# From docs/use-cases (2026-09): UC-28 release feed, UC-11 rankings, UC-14 "surprise me".
# Priority tags: @must / @should / @could.

Feature: Latest updates and rankings
  As a reader
  I want to see what just came out and what everyone is reading
  So that I never miss a new chapter and always find something good

  Background:
    Given the catalog has the series "Solo Leveling", "One Piece" and "Horimiya"
    And "Solo Leveling" is in the library of "Kenji"

  # Inspired by: MangaDex "Latest updates", WEBTOON "Updated"
  @must
  Scenario: Seeing the latest chapters
    Given chapter 180 of "One Piece" came out 10 minutes ago and chapter 6 of "Solo Leveling" 2 hours ago
    When "Kenji" opens "Latest updates"
    Then he sees "One Piece" chapter 180 first, marked "10 minutes ago"
    And each chapter has a "Read now" button

  # Inspired by: MangaDex and comix.to, where each release names its group
  @should
  Scenario: Each release names the team that translated it
    Given the team "Shadow Scans" published chapter 7 of "Solo Leveling" 5 minutes ago
    When "Kenji" opens "Latest updates"
    Then the release of "Solo Leveling" chapter 7 is credited to "Shadow Scans"

  # Inspired by: MangaDex "Follows" feed
  @must
  Scenario: Only the series in my library
    Given chapters 5 and 6 of "Solo Leveling" and chapter 180 of "One Piece" came out today
    And "Kenji" read chapter 5 of "Solo Leveling"
    When "Kenji" opens "Latest updates" and chooses "My library"
    Then he only sees chapters of "Solo Leveling"
    And chapter 5 is marked "Read" and chapter 6 is not

  # Inspired by: comix.to, WEBTOON trending
  # Score: reads + 3 × comments + 5 × library adds during the chosen period.
  @should
  Scenario: Popular this week
    Given "Horimiya" had the most reads, comments and library adds this week
    When a reader opens "Popular" and picks "This week"
    Then "Horimiya" is number 1
    And the ranking can also show "Today", "This month" and "All time"

  # Inspired by: MyAnimeList / AniList top charts
  @should
  Scenario: Top rated needs enough ratings
    Given "One Piece" has an average of 9.1 from 40 ratings
    And "Horimiya" has an average of 10 from 2 ratings
    When a reader opens "Top rated"
    Then "One Piece" is listed
    And "Horimiya" is not listed until it has at least 5 ratings

  # Inspired by: comix.to random pick
  @could
  Scenario: Surprise me
    When a reader clicks "Surprise me" with the genre "Romance" wanted
    Then a random "Romance" series opens
