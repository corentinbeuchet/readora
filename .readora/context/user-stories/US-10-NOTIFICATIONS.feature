# From docs/use-cases (2026-09): UC-27 release notifications, UC-29 social notifications.
# In-app first; browser push and e-mail digests can come later.
# Priority tags: @must / @should / @could.

Feature: Notifications
  As a reader
  I want to be told when something I care about happens
  So that I come back at the right time

  Background:
    Given "Kenji" is signed in and has "Solo Leveling" in his library

  # Inspired by: WEBTOON, MangaDex
  @must
  Scenario: A new chapter of a series in my library
    When chapter 7 of "Solo Leveling" is published
    Then "Kenji" gets a notification "Solo Leveling: chapter 7 is out"
    And clicking it opens chapter 7

  @must
  Scenario: The notification bell
    Given "Kenji" has 3 unread notifications
    Then the bell shows 3
    When he chooses "Mark all as read"
    Then the bell shows no count

  # Inspired by: every comment system
  @should
  Scenario: Someone replies to my comment
    Given "Kenji" commented on chapter 5 of "Solo Leveling"
    When "Aoi" replies to his comment
    Then "Kenji" gets a notification "Aoi replied to your comment"
    And clicking it opens chapter 5 with the reply highlighted

  @could
  Scenario: Muting a series
    When "Kenji" turns off notifications for "Solo Leveling"
    And chapter 8 of "Solo Leveling" is published
    Then "Kenji" gets no notification
    And "Solo Leveling" stays in his library
