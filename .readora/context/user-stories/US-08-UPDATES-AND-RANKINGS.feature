# From docs/use-cases (2026-09): UC-28 release feed, UC-11 rankings, UC-14 "surprise me".
# Priority tags: @must / @should / @could. @wip = not built yet (feature level: nothing here is built).

@wip
Feature: Latest updates and rankings
  As a reader
  I want to see what just came out and what everyone is reading
  So that I never miss a new chapter and always find something good

  Background:
    Given the catalog has the series "Solo Leveling", "One Piece" and "Horimiya"
    And "Kenji" has "Solo Leveling" in his library

  # Inspired by: MangaDex "Latest updates", WEBTOON "Updated"
  @must
  Scenario: Seeing the latest chapters
    Given chapter 180 of "One Piece" came out 10 minutes ago and chapter 6 of "Solo Leveling" 2 hours ago
    When "Kenji" opens "Latest updates"
    Then he sees "One Piece" chapter 180 first, marked "10 minutes ago"
    And each chapter has a "Read now" button

  # Inspired by: MangaDex "Follows" feed
  @must
  Scenario: Only the series in my library
    When "Kenji" opens "Latest updates" and chooses "My library"
    Then he only sees chapters of "Solo Leveling"
    And chapters he already read are marked "Read"

  # Inspired by: comix.to, WEBTOON trending
  # Score: reads + 3 × comments + 5 × library adds over the period, older activity counting less.
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
