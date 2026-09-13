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

  Scenario: Cleaner claims task and submits cleaned asset package
    Given "Chapter 10" workflow task is in stage "RAW_UPLOADED"
    When "Alice" claims the task for "Chapter 10"
    And "Alice" uploads cleaned page package with 22 pages
    Then the task status becomes "COMPLETED" for "CLEANING"
    And the chapter workflow stage advances to "TRANSLATING"

  Scenario: Unauthorized member attempts stage transition
    Given "Chapter 10" workflow task is in stage "TRANSLATING"
    When "Alice" attempts to claim the translation task
    Then the assignment is rejected because "Alice" lacks the "TRANSLATOR" role

  Scenario: Translator submits script and advances stage to Typesetting
    Given "Chapter 10" workflow task is assigned to "Bob" in stage "TRANSLATING"
    When "Bob" submits the translated script mapping for 22 pages
    Then the task stage advances to "TYPESETTING"

  Scenario: Quality Checker publishes verified chapter
    Given "Chapter 10" has passed proofreading and is in stage "QC_REVIEW"
    When "Charlie" approves the final assembled chapter and triggers publication
    Then the chapter status becomes "PUBLISHED"
    And a "ChapterPublishedEvent" is emitted to notify readers
