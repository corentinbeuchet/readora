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
    Given reader "Camille" is signed in
    When they open the account menu
    Then it offers "Studio", since any reader can start or join a team
    But the navigation does not
    And only a moderator's account menu also offers "Moderation"

  @ui @must
  Scenario: A visitor sees what is read this week
    When a visitor opens the home page
    Then the most read series of the week is featured with its cover
    And the next four follow as a numbered list with a link to the full ranking

  @ui @must
  Scenario: I can continue reading from the home page
    Given reader "Camille" last read chapter 12 of "Solo Leveling" without finishing it
    When she opens the home page
    Then "Continue reading" offers "Solo Leveling" with a link straight to chapter 12

  @ui @should
  Scenario: New chapters of my library are on the home page
    Given a new chapter of a series in the library of reader "Camille" is out
    When she opens the home page
    Then "New in your library" shows that chapter with a link to read it

  @ui @should
  Scenario: Several new chapters of one series make one tile
    Given chapters 6, 7 and 8 of "Solo Leveling" are new in the library of reader "Camille"
    When she opens the home page
    Then "New in your library" shows "Solo Leveling" once, marked "3 new"
    And its link opens chapter 6, the first she has not read

  @ui @should
  Scenario: A visitor is invited to create an account after seeing the content
    When a visitor opens the home page
    Then a prompt to create a free account comes after the first sections, not before them
    And a signed-in reader does not see it
