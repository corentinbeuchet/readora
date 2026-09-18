# From docs/use-cases (2026-09): UC-24 ratings and structured reviews. Brings back the score dropped from US-04.
# Priority tags: @must / @should / @could.

Feature: Ratings and reviews
  As a reader
  I want to rate series and read what others thought
  So that I can pick what to read next and share my opinion

  Background:
    Given "Kenji" and "Aoi" are signed in
    And the catalog has the series "Berserk"

  # Inspired by: MyAnimeList, AniList
  @must
  Scenario: Rating a series
    When "Kenji" rates "Berserk" 9 out of 10
    Then his rating of "Berserk" is 9
    When he rates it 10
    Then his rating of "Berserk" is 10 and he still counts as one rating

  @must
  Scenario: Seeing the average rating
    Given "Kenji" rated "Berserk" 9 and "Aoi" rated it 7
    When a reader opens the page of "Berserk"
    Then it shows a score of 8.0 from 2 ratings

  # Inspired by: MyAnimeList reviews
  @should
  Scenario: Writing a review
    When "Kenji" writes a review of "Berserk" with what he liked, what he didn't and a verdict
    Then the review appears on the "Berserk" page with his rating

  @should
  Scenario: Voting a review helpful
    Given "Kenji" wrote a review of "Berserk"
    When "Aoi" marks it as helpful
    Then the review shows 1 helpful vote
    And "Kenji" cannot mark his own review as helpful
