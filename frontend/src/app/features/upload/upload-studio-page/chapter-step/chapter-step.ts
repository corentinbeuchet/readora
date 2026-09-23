import { Component, computed, inject, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { CatalogApi } from '@app/core/api/catalog-api';
import { ExistingSeries, UploadWizard, parseChapterNumber } from '@app/features/upload/upload-studio-page/upload-wizard';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';

/** Step 2: the chapter's number and title, and how it is published (directly or through the scanlation team). */
@Component({
  selector: 'app-chapter-step',
  imports: [FieldErrors, AriaInvalidDirective, FormField],
  templateUrl: './chapter-step.html',
  styleUrl: './chapter-step.scss'
})
export class ChapterStep {
  protected readonly wizard = inject(UploadWizard);
  protected readonly form = this.wizard.form;

  /** The existing series and team the chapter is published into; `null` for a new series (no other version). */
  readonly existing = input<ExistingSeries | null>(null);

  private readonly chapters = inject(CatalogApi).chaptersResource(computed(() => this.existing()?.work.id));
  private readonly number = computed(() => parseChapterNumber(this.wizard.draft().chapterNumber));
  /** The published versions of the chapter number being typed, compared as numbers (`5` = `5.0`). */
  private readonly versions = computed(() => {
    const number = this.number();
    if (number === null || !this.chapters.hasValue()) return [];
    return this.chapters.value().filter((chapter) => Number(chapter.chapterNumber) === Number(number));
  });
  /** Teams that already published this chapter number, other than mine. */
  protected readonly otherTeams = computed(() =>
    this.versions()
      .map((chapter) => chapter.team)
      .filter((team) => team.id !== this.existing()?.team.id)
  );
  /** My team already has this chapter: the server would refuse it (`CHAPTER_ALREADY_EXISTS`). */
  protected readonly alreadyMine = computed(() => this.versions().some((chapter) => chapter.team.id === this.existing()?.team.id));
}
