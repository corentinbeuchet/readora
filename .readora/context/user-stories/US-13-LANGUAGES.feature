# Interface languages: English (default, site root) and French (under /fr/). Series titles, synopses and comments
# stay as their authors wrote them; only the interface is translated.
# @ui = frontend-only, verified by a Vitest test named after the scenario (not run by Cucumber).

Feature: Reading Readora in my language
  As a reader
  I want the interface in French or English
  So that I can find, read and discuss series in the language I'm comfortable with

  @ui
  Scenario: The French site shows French text and dates
    When reader "Camille", who joined on 1 January 2026, opens her profile on the French site
    Then the first tab reads "Aperçu"
    And her join date reads "inscrit le 1 janv. 2026"

  @ui
  Scenario: Switching language keeps the current page
    Given reader "Camille" is on the English page of the series "Solo Leveling"
    When they choose "Français" in the footer
    Then they are on the French page of the series "Solo Leveling"

  @ui
  Scenario: Errors from the server are shown in my language
    Given reader "Camille" uses the French site
    When the server refuses a request with the code "INVALID_CREDENTIALS"
    Then they see "E-mail ou mot de passe incorrect."

  Scenario: Every refused request carries a stable error code
    When a visitor logs in with a wrong password
    Then the request is refused with the error code "INVALID_CREDENTIALS"
    When reader "Camille" rates a series that does not exist
    Then the request is refused with the error code "NOT_FOUND"
