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

  # Inspired by: every site with accounts. The link is the proof of owning the email; it works once, for 30 minutes,
  # and the answer never says whether an email has an account.
  @must
  Scenario: Choosing a new password after forgetting it
    When someone asks for a password reset link for "camille@readora.test"
    Then "Camille" receives an email with a link to choose a new password
    When the link from the email sets the password "second-password"
    Then "Camille" can log in with "second-password" but not with "first-password"
    And the first device of "Camille" is signed out

  @must
  Scenario: Asking for a link for an unknown email sends nothing
    When someone asks for a password reset link for "nobody@readora.test"
    Then no email is sent

  @should
  Scenario: A reset link works once
    Given "Camille" asked for a password reset link
    And the link from the email set the password "second-password"
    When the link from the email sets the password "third-password"
    Then the reset is refused with the error code "RESET_LINK_INVALID"

  @should
  Scenario: A reset link expires after 30 minutes
    Given "Camille" asked for a password reset link
    When 31 minutes pass
    And the link from the email sets the password "second-password"
    Then the reset is refused with the error code "RESET_LINK_INVALID"
    And "Camille" can still log in with "first-password"
