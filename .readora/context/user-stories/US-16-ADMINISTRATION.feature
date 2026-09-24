# Account administration (plan of 2026-09-23, phase 2): what an admin needs to run the site without a database
# console. USER_MANAGE (admins). Priority tags: @must / @should / @could.

Feature: Looking after accounts
  As an admin
  I want to find an account and change what it may do
  So that the site stays safe and moderators can be named

  Background:
    Given "Ada" is an admin
    And "Kenji" has a reader account

  @must
  Scenario: Finding an account
    When "Ada" looks for accounts starting with "ken"
    Then the account of "Kenji" is found with the role "READER"

  @must
  Scenario: Naming a moderator
    When "Ada" gives "Kenji" the role "MODERATOR"
    Then "Kenji" can moderate comments

  # Suspended: the account comes back by itself after the date; its sessions end now. Writes with a token issued
  # before are refused too (checked on each request, see the web tests).
  @must
  Scenario: A suspended reader is signed out until the date
    Given "Kenji" has an open session
    When "Ada" suspends "Kenji" for 7 days
    Then the session of "Kenji" is over
    And "Kenji" cannot log in, with the error code "ACCOUNT_SUSPENDED"
    When 8 days pass
    Then "Kenji" can log in again

  @must
  Scenario: A banned reader stays out until reinstated
    When "Ada" bans "Kenji"
    Then "Kenji" cannot log in, with the error code "ACCOUNT_BANNED"
    When "Ada" reinstates "Kenji"
    Then "Kenji" can log in again

  @must
  Scenario: Only admins look after accounts
    When "Kenji" tries to ban "Ada"
    Then the ban is refused
    And "Ada" can log in again

  # An admin who demoted or banned themselves could leave the site without anyone to undo it.
  @should
  Scenario: An admin does not administer their own account
    When "Ada" gives "Ada" the role "READER"
    Then the change is refused with the error code "SELF_ADMINISTRATION"
