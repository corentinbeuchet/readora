# Finding my way: the site navigation and the home page.
# On a computer the navigation sits in the header and the logo is the way home; on a phone or tablet the same
# navigation is a bar at the bottom of the screen (which of the two is shown is a matter of layout, checked by the
# end-to-end tests).
# @ui = frontend-only, verified by a Vitest test named after the scenario (not run by Cucumber).

Feature: Home and navigation
  As a reader
  I want the main sections one tap away and a home page that starts from what I read
  So that I get to my next chapter without searching for it

  @ui @must
  Scenario: The main sections are always one tap away
    When a visitor opens Readora
    Then the navigation offers "Home", "Browse", "Updates", "Rankings" and "Lists"
    And each of them is a link, not an entry hidden behind a menu button

  @ui @must
  Scenario: My library is in the navigation once I am signed in
    Given a visitor sees no "Library" entry in the navigation
    When reader "Camille" signs in
    Then the navigation offers "Library"

  @ui @should
  Scenario: Team tools live in the account menu
    Given scanlator "Leader" is signed in
    When they open the account menu
    Then it offers "Scanlation workspace" and "Upload Studio"
    But the navigation does not
    And the account menu of reader "Camille" has no team tools
