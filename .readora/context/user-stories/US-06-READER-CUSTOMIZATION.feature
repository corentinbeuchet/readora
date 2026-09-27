# Rewritten 2026-09 from the first draft: the gapless strip is already the default (no setting needed),
# auto-scroll moved to US-07, and reports are described by what the team sees instead of an internal event.
# @ui = frontend-only, verified by a Vitest test named after the scenario (not run by Cucumber).

Feature: Distraction-free reading and broken pages
  As a reader
  I want to hide everything but the pages, and to report a page that does not display
  So that I can read without distractions and bad pages get fixed

  Background:
    Given reader "Kenji" is reading chapter 1 of "Solo Leveling", translated by the team "Shadow Scans"

  @ui @e2e
  Scenario: Reading in zen mode
    When "Kenji" turns on zen mode
    Then the site header and the reader toolbar are hidden
    When he moves the mouse or taps the screen
    Then the reader toolbar comes back and hides again after 3 seconds
    When he presses Escape
    Then zen mode is off

  Scenario: Reporting a broken page
    When "Kenji" reports page 7 as "Image corrupted"
    Then the team "Shadow Scans" sees 1 open report, for page 7 of chapter 1

  Scenario: Reporting the same page twice counts once
    When "Kenji" reports page 7 as "Image corrupted"
    And "Kenji" reports page 7 as "Image corrupted"
    Then the team "Shadow Scans" sees 1 open report, for page 7 of chapter 1

  Scenario: The team marks a report as fixed
    Given "Kenji" reported page 7 as "Image corrupted"
    When a member of "Shadow Scans" marks the report as fixed
    Then the team "Shadow Scans" sees no open report

  Scenario: Only the team can see reports
    Given "Kenji" reported page 7 as "Image corrupted"
    When reader "Aoi" asks for the open reports of "Shadow Scans"
    Then the request is refused
