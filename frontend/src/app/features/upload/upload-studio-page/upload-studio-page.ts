import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { TeamsApi } from '@app/core/api/teams-api';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';
import { ChapterStep } from './chapter-step/chapter-step';
import { PagesStep } from './pages-step/pages-step';
import { ReviewStep } from './review-step/review-step';
import { SeriesStep } from './series-step/series-step';
import { UploadSuccess } from './upload-success/upload-success';
import { WizardSteps } from './wizard-steps/wizard-steps';
import { PublishFlow } from './publish-flow';
import { ExistingSeries, UploadWizard } from './upload-wizard';

export { GENRE_PRESETS, parseChapterNumber } from './upload-wizard';
export type { PublishingMode, UploadStep } from './upload-wizard';

/**
 * Upload studio (`/upload`): a wizard to create a series and publish its first chapter, directly or through the
 * scanlation team. With `?workId=&teamId=` (from "My teams") it publishes a chapter of an existing series for that
 * team instead. The draft and the publish flow are provided here, so each visit starts with an empty wizard.
 */
@Component({
  selector: 'app-upload-studio-page',
  imports: [WizardSteps, SeriesStep, ChapterStep, PagesStep, ReviewStep, UploadSuccess, LoadError, RouterLink],
  templateUrl: './upload-studio-page.html',
  styleUrl: './upload-studio-page.scss',
  providers: [UploadWizard, PublishFlow]
})
export class UploadStudioPage {
  protected readonly wizard = inject(UploadWizard);
  private readonly catalogApi = inject(CatalogApi);
  private readonly teamsApi = inject(TeamsApi);

  /** Bound from `?workId=`: the existing series to publish into. */
  readonly workId = input<string>();
  /** Bound from `?teamId=`: the team of mine that publishes the chapter. */
  readonly teamId = input<string>();

  protected readonly intoExistingSeries = computed(() => !!this.workId() && !!this.teamId());
  protected readonly work = this.catalogApi.workResource(computed(() => (this.intoExistingSeries() ? this.workId() : undefined)));
  protected readonly myTeams = this.teamsApi.mineResource(this.intoExistingSeries);

  /** The series and team to publish into, once both are loaded; `null` for a new series. */
  protected readonly existing = computed<ExistingSeries | null>(() => {
    const work = this.work.hasValue() ? this.work.value() : undefined;
    const team = this.myTeams.hasValue() ? this.myTeams.value().find((t) => t.id === this.teamId()) : undefined;
    return work && team ? { work, team: { id: team.id, name: team.name } } : null;
  });
  protected readonly loadingExisting = computed(() => this.intoExistingSeries() && (this.work.isLoading() || this.myTeams.isLoading()));
  /** Both loaded, yet the team is not one of mine. */
  protected readonly notMyTeam = computed(() => this.intoExistingSeries() && !this.loadingExisting() && this.work.hasValue() && !this.existing());
  protected readonly seriesValid = computed(() => (this.intoExistingSeries() ? this.existing() !== null : this.wizard.seriesValid()));

  constructor() {
    inject(SeoService).update({
      title: $localize`:@@upload.studio.seoTitle:Upload Studio — Readora`,
      description: $localize`:@@upload.studio.seoDescription:Create manga series, upload chapter pages, and publish directly or via scanlation pipeline.`,
      path: '/upload'
    });
  }
}
