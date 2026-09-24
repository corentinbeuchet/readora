# Account essentials (plan of 2026-09-23, phase 2): what a site with accounts lets a reader do alone, without
# writing to anyone. Priority tags: @must / @should / @could.

Feature: My account
  As a reader
  I want to look after my own account
  So that it stays safe and stays mine

  Background:
    Given "Camille" has an account with the password "first-password"

  # Inspired by: every account settings page. Changing it signs out the other devices, as after a leak.
  @must
  Scenario: Changing my password
    Given "Camille" is signed in on two devices
    When "Camille" changes the password from "first-password" to "second-password" on the first device
    Then "Camille" can log in with "second-password" but not with "first-password"
    And the second device of "Camille" is signed out
    And the first device of "Camille" stays signed in

  @must
  Scenario: A wrong current password changes nothing
    When "Camille" changes the password from "not-the-password" to "second-password" on the first device
    Then the password change is refused with the error code "WRONG_PASSWORD"
    And "Camille" can still log in with "first-password"
