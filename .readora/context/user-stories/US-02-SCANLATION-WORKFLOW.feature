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
  Scenario: Quality Checker publishes verified chapter
    Given "Chapter 10" has passed proofreading and is in stage "QC_REVIEW" with 3 pages uploaded
    When "Charlie" approves the final assembled chapter and triggers publication
    Then the chapter status becomes "PUBLISHED"
    And the chapter is credited to the team "FlameScans"
    And the published chapter has the 3 pages the team uploaded, in order
    And a "ChapterPublishedEvent" is emitted to notify readers

  Scenario: A chapter without pages is not published
    Given "Chapter 11" is in stage "QC_REVIEW" with no pages uploaded
    When "Charlie" approves the final assembled chapter and triggers publication
    Then the publication is refused because the chapter has no pages
