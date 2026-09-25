Feature: Collaborative Scanlation Chapter Workflow Pipeline
  As a scanlation team member
  I want tasks to enforce role-based stage transitions and asset handover
  So that release quality is systematically maintained from RAWs to publication

  Background:
    Given a scanlation team "FlameScans" exists
    And "Solo Leveling" has a scanlation project managed by "FlameScans"
    And team member "Alice" has role "CLEANER_REDRAWER"
    And team member "Bob" has role "TRANSLATOR"
    And team member "Charlie" has role "QUALITY_CHECKER"

  Scenario: Cleaner claims task and submits cleaned pages
    Given "Chapter 10" workflow task is in stage "RAW_UPLOADED"
    When "Alice" claims the task for "Chapter 10"
    And "Alice" uploads 22 cleaned pages
    Then the task status becomes "COMPLETED" for "CLEANING"
    And the chapter workflow stage advances to "TRANSLATING"

  Scenario: Unauthorized member attempts stage transition
    Given "Chapter 10" workflow task is in stage "TRANSLATING"
    When "Alice" attempts to claim the translation task
    Then the assignment is rejected because "Alice" lacks the "TRANSLATOR" role

  Scenario: A member of another team cannot claim the task
    Given "Chapter 10" workflow task is in stage "RAW_UPLOADED"
    And "Dana" has role "CLEANER_REDRAWER" in another team "Moon Scans"
    When "Dana" claims the task for "Chapter 10"
    Then the assignment is rejected because "Dana" is not on the team

  Scenario: Translator submits script and advances stage to Typesetting
    Given "Chapter 10" workflow task is assigned to "Bob" in stage "TRANSLATING"
    When "Bob" uploads 22 translated pages
    Then the task stage advances to "TYPESETTING"

  # Readers get the pages the team uploaded at the last stage, never names made up from the chapter number (B19).
  # A team's first chapter waits for a moderator (US-11); this team has published before.
  Scenario: Quality Checker publishes verified chapter
    Given the team has published chapters before
    And "Chapter 10" has passed proofreading and is in stage "QC_REVIEW" with 3 pages uploaded
    When "Charlie" approves the final assembled chapter and triggers publication
    Then the chapter status becomes "PUBLISHED"
    And the chapter is credited to the team "FlameScans"
    And the published chapter has the 3 pages the team uploaded, in order
    And a "ChapterPublishedEvent" is emitted to notify readers

  Scenario: A chapter without pages is not published
    Given "Chapter 11" is in stage "QC_REVIEW" with no pages uploaded
    When "Charlie" approves the final assembled chapter and triggers publication
    Then the publication is refused because the chapter has no pages

  # Members see who holds a task by username, never by account id (review-2026-09-19/R18).
  @ui
  Scenario: The task board names who holds each task
    Given "Chapter 10" workflow task is assigned to "Bob" in stage "TRANSLATING"
    Then the task board shows the task is held by "@bob"

  # A board keeps every chapter it published and every page of every task: it sends page counts, a task's pages load
  # when a member opens them, and the published column shows the latest chapters first.
  Scenario: Only the team opens the pages of a task
    Given "Chapter 10" workflow task is in stage "RAW_UPLOADED" with 3 pages
    Then "Alice" gets pages 1 to 3 of "Chapter 10"
    And "Dana", who is not on the team, is refused the pages of "Chapter 10"

  @ui
  Scenario: A task's pages load when a member opens them
    Given "Chapter 10" workflow task is in stage "RAW_UPLOADED" with 3 pages
    When "Alice" opens the pages of "Chapter 10" on the task board
    Then she sees links to pages 1 to 3

  @ui
  Scenario: The published column shows the latest 10 chapters, older ones on request
    Given 14 chapters of "Solo Leveling" were published from the board
    Then the published column shows the 10 latest
    When a member asks for the older ones
    Then all 14 are shown

  # Members hear when a chapter reaches their stage (in-app, US-10) instead of watching the board. Whoever acted is
  # not told about their own work; with nobody in the role, the leaders are, so no chapter waits unseen.
  Scenario: The members of the next stage are told a chapter is ready for them
    Given "Chapter 10" workflow task is assigned to "Alice" in stage "RAW_UPLOADED"
    When "Alice" uploads 22 cleaned pages
    Then "Bob" is told "Solo Leveling: chapter 10 is ready for translation"
    And "Alice" is not told about chapter 10
    And "Charlie" is not told about chapter 10

  Scenario: Cleaners are told when a raw chapter goes on the board
    Given the team uses the task board for this series
    When "Charlie" puts the 20 raw pages of chapter 12 on the board
    Then "Alice" is told "Solo Leveling: chapter 12 is ready for cleaning"
    And "Charlie" is not told about chapter 12

  Scenario: With nobody in the next stage's role, the leaders are told
    Given "Chapter 10" workflow task is assigned to "Bob" in stage "TRANSLATING"
    When "Bob" uploads 22 translated pages
    Then "LeaderBob" is told "Solo Leveling: chapter 10 is ready for typesetting"
