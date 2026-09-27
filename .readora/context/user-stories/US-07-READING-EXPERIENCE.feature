# Ideas from the most popular reading platforms (research 2026-09): WEBTOON (~157M monthly users), Piccoma,
# MangaDex, MANGA Plus, Mihon (Tachiyomi successor), Shonen Jump, Tapas.
# Priority tags: @must / @should / @could.
# @ui = frontend-only, verified by a Vitest test named after the scenario (not run by Cucumber).
# @e2e = also run in a browser against the real stack (playwright-bdd, `npm run e2e:stories`).
# @wip = not built yet. Offline reading needs a service worker and downloaded chapters: left for later.
# Untagged scenarios (next chapter, read markers, history, new-chapter badges) run as Cucumber acceptance tests.

Feature: A reading experience as good as the best manga and webtoon apps
  As a reader
  I want the reader to adapt to what I read and get out of my way
  So that I can read chapter after chapter without friction

  Background:
    Given "Kenji" is signed in
    And the catalog has the manhwa "Solo Leveling" and the manga "One Piece"

  # ---------------------------------------------------------------- @must

  # Inspired by: WEBTOON, MANGA Plus
  @must
  Scenario: Going to the next chapter from the end of a chapter
    Given "Kenji" is on the last page of chapter 4 of "Solo Leveling"
    Then he sees a "Next chapter" button, a "Previous chapter" button and the chapter list
    When he clicks "Next chapter"
    Then chapter 5 opens on its first page

  # Inspired by: MANGA Plus, Mihon
  @must @ui @e2e
  Scenario: Reading manga right to left
    Given "Kenji" reads "One Piece" in paged mode
    When he chooses "Right to left"
    Then the "Next" arrow and swipe direction go to the left
    And the page order follows the Japanese reading direction

  # Inspired by: Mihon, MangaDex
  @must @ui @e2e
  Scenario: The reader opens in the right mode for the format
    When "Kenji" opens a chapter of the manhwa "Solo Leveling"
    Then it opens in vertical mode
    When he opens a chapter of the manga "One Piece"
    Then it opens in paged right-to-left mode

  # Inspired by: Mihon
  @must @ui @e2e
  Scenario: The reader remembers my mode for each series
    Given "Kenji" switched "One Piece" to vertical mode
    When he opens another chapter of "One Piece"
    Then it opens in vertical mode
    And "Solo Leveling" keeps its own mode

  # Inspired by: MangaDex, Mihon
  @must @ui @e2e
  Scenario: Turning pages with the keyboard or a click
    Given "Kenji" reads a chapter in paged mode
    When he presses the right arrow, Space or Page Down
    Then the next page is shown
    And clicking the left or right third of the page also turns it

  # Inspired by: all major reading apps
  @must @ui @e2e
  Scenario: Pages turn instantly
    Given "Kenji" is on page 3 of a chapter
    Then pages 4 and 5 are already loaded
    And turning the page shows the next image without waiting

  # Inspired by: Mihon, MangaDex
  @must @ui @e2e
  Scenario: Fitting the page to my screen
    When "Kenji" chooses "Fit width", "Fit height" or "Original size"
    Then the page is resized that way
    And the choice is kept for his next chapters

  # Inspired by: Mihon, MangaDex
  @must
  Scenario: Seeing which chapters I already read
    Given "Kenji" finished chapters 1 to 4 of "Solo Leveling"
    When he opens the chapter list
    Then chapters 1 to 4 are dimmed
    And chapter 5 is highlighted as the next one to read

  @must @ui @e2e
  Scenario: Having read every chapter, the series page offers to read it again
    Given "Kenji" finished every published chapter of "Horimiya"
    When he opens the page of "Horimiya"
    Then he is told he is up to date
    And the main button is "Read again", which opens chapter 1

  @should @ui @e2e
  Scenario: A saved page in a chapter I already finished does not hide the next chapter
    Given "Solo Leveling" has chapters 1, 2 and 3
    And "Kenji"'s saved page is in chapter 2 of "Solo Leveling"
    And he finished chapters 1 and 2
    When he opens the page of "Solo Leveling"
    Then the main button is "Continue with chapter 3"

  # Inspired by: WEBTOON "My" page
  @must
  Scenario: Finding what I was reading
    Given "Kenji" read "Solo Leveling" yesterday and "One Piece" today
    When he opens his History page
    Then he sees "One Piece" first, then "Solo Leveling"
    And each has a "Continue" button that opens the last chapter he read

  # ---------------------------------------------------------------- @should

  # Inspired by: MangaDex
  @should @ui @e2e
  Scenario: Seeing where I am and jumping to a page
    Given "Kenji" is on page 8 of 20
    Then a thin progress bar shows he is 40% through the chapter
    When he clicks the end of the bar
    Then page 20 is shown

  # Inspired by: Shonen Jump, MangaDex
  @should @ui @e2e
  Scenario: Reading two pages side by side
    Given "Kenji" reads "One Piece" on a wide screen
    When he turns on "Double page"
    And he turns the page
    Then two pages are shown side by side like a printed book

  # Inspired by: most-requested missing feature in WEBTOON and Tachiyomi forks
  @should @ui @e2e
  Scenario: Letting a webtoon scroll by itself
    Given "Kenji" reads "Solo Leveling" in vertical mode
    When he turns on auto-scroll at medium speed
    Then the chapter scrolls slowly on its own
    And it stops as soon as he touches or scrolls the page

  # Inspired by: Mihon
  @should @ui @e2e
  Scenario: Changing the background colour
    When "Kenji" picks a black, gray or white background
    Then the space around the pages uses that colour

  # Inspired by: Mihon, WEBTOON
  @should
  Scenario: Knowing when new chapters are out
    Given "Kenji" has "Solo Leveling" in his library and read up to chapter 5
    When chapters 6 and 7 are published
    Then his library shows a "2 new" badge on "Solo Leveling"

  # Several teams may translate the same chapter (US-12): progress follows the chapter number, not the version.
  @should
  Scenario: A chapter read in any version is read
    Given two teams published chapter 5 of "Solo Leveling", and one of them chapter 6
    When "Kenji" finishes the second team's version of chapter 5
    Then chapter 5 counts as read
    And chapter 6 is next to read

  @should
  Scenario: A second version is not a new chapter
    Given "Kenji" has "Solo Leveling" in his library and read up to chapter 5
    When another team publishes its own version of chapter 5
    Then his library shows no new chapter on "Solo Leveling"

  # Inspired by: MangaDex
  @should
  Scenario: Saving mobile data
    When "Kenji" turns on "Data saver"
    Then chapters load lighter, lower-quality images

  # Inspired by: the Save-Data client hint (browsers' "Lite mode" / data saver setting)
  @should @ui @e2e
  Scenario: The data saver follows the browser's data-saving mode until I choose
    Given Kenji's browser asks sites to save data
    And "Kenji" never turned "Data saver" on or off
    Then chapters load lighter, lower-quality images
    When "Kenji" turns off "Data saver"
    Then chapters load the full images, even though the browser still asks to save data

  # Inspired by: MangaDex (from docs/use-cases UC-17)
  @should
  Scenario: Marking all previous chapters as read
    Given "Kenji" read chapters 1 to 49 of "Solo Leveling" on another site
    When he chooses "Mark all previous as read" on chapter 50
    Then chapters 1 to 49 are marked as read
    And chapter 50 is highlighted as the next one to read

  # Inspired by: MangaDex reader side panel (from docs/use-cases UC-08)
  @should @ui @e2e
  Scenario: Opening the chapter list inside the reader
    Given "Kenji" is reading chapter 5 of "Solo Leveling"
    And he finished chapters 1 and 2
    When he opens the chapter list from the reader
    Then he sees every chapter with the ones he read marked
    And choosing chapter 2 opens it without leaving the reader

  # ---------------------------------------------------------------- @could

  # Inspired by: WEBTOON, Shonen Jump, Mihon
  @could @wip
  Scenario: Reading without internet
    Given "Kenji" downloaded chapter 6 of "Solo Leveling"
    When he loses his connection
    Then he can still read chapter 6

  # Inspired by: WEBTOON
  @could
  Scenario: Seeing the best comments at the end of a chapter
    Given chapter 5 has many comments
    When "Kenji" reaches the last page
    Then the three most-upvoted comments without spoilers are shown under it

  # Differentiator: no major platform does this well
  @could @ui @e2e
  Scenario: Reading with a screen reader
    Given "Aiko" uses a screen reader
    And she is on page 2 of 20 of a chapter whose uploader described page 3 as "Jin-Woo opens the gate"
    When she turns a page
    Then she hears "Page 3 of 20"
    And she hears the page description the uploader wrote
