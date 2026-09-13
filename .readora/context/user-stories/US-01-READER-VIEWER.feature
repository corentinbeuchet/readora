Feature: Reader Chapter Viewer and Progression
  As a manga/comic reader
  I want to view chapter pages seamlessly with customizable reading modes and automatic progress tracking
  So that I have an optimal reading experience on any device

  Background:
    Given the reader "Kenji" is registered on Readora
    And a published work "Solo Leveling" exists with "Chapter 1" containing 20 pages

  Scenario: Loading and viewing a chapter in vertical scroll mode
    Given "Kenji" opens "Chapter 1" of "Solo Leveling"
    When "Kenji" sets the view mode to "VERTICAL"
    Then the viewer should render all 20 page assets in sequential order
    And the page URLs should point to optimized CDN edge endpoints

  Scenario: Progress synchronization when reading pages
    Given "Kenji" is reading "Chapter 1" of "Solo Leveling"
    When "Kenji" scrolls to and views page 15
    Then his reading bookmark for "Solo Leveling" should record "Chapter 1" at page 15
    And his reading status should be set to "READING"

  Scenario: Attempting to access an unpublished chapter as a regular reader
    Given "Chapter 2" of "Solo Leveling" has status "DRAFT"
    When "Kenji" attempts to read "Chapter 2"
    Then the access should be rejected with a "CHAPTER_NOT_PUBLISHED" error
