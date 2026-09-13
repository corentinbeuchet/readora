Feature: Reader Social Interaction and Threaded Comments
  As an active reader
  I want to post threaded comments and ratings on chapters
  So that I can engage with the community and share reactions

  Background:
    Given a published chapter "Chapter 1" of "Solo Leveling" exists
    And reader "Kenji" and reader "Aoi" are authenticated

  Scenario: Posting a top-level comment with spoiler protection
    When "Kenji" posts a comment "The boss appearance on page 12 is insane!" on "Chapter 1" with page reference 12 and spoiler flag true
    Then the comment should be recorded with spoiler status enabled
    And the comment should link to page 12 of "Chapter 1"

  Scenario: Replying to an existing comment creates nested thread
    Given "Kenji" has posted comment "C1" on "Chapter 1"
    When "Aoi" posts a reply "Totally agree with this!" to comment "C1"
    Then the new comment should have parent id "C1"
    And the comment thread depth should be within the maximum allowed limit of 5

  Scenario: Upvoting a comment increases vote tally
    Given "Kenji" has posted comment "C1" on "Chapter 1" with 0 upvotes
    When "Aoi" upvotes comment "C1"
    Then the comment "C1" upvote count should be 1
