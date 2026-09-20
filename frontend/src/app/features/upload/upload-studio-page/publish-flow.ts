import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { CatalogApi } from '@app/core/api/catalog-api';
import { ScanlationApi } from '@app/core/api/scanlation-api';
import { Work } from '@app/core/models/catalog';
import { ScanlationProject } from '@app/core/models/scanlation';
import { DirectPublishChapterPayload } from '@app/core/models/chapter';
import { PageUploadItem } from './file-utils';
import { UploadService } from './upload.service';
import { ExistingSeries, UploadWizard, parseChapterNumber } from './upload-wizard';

const NO_PROJECT_ERROR = $localize`:@@upload.publish.noProject:Your team does not work on this series yet. Add the series to your team from My teams, then publish again.`;

/** A failure whose message is written for the user (as opposed to an unexpected exception). */
class UploadFlowError extends Error {}

/**
 * Publishing the wizard's series and chapter, provided by the upload studio page.
 *
 * Retry-safe: every step records what it created (cover URL, Work, uploaded pages, chapter/task), so a retry after a
 * partial failure resumes where it stopped instead of duplicating entities.
 */
@Service({ autoProvided: false })
export class PublishFlow {
  private readonly wizard = inject(UploadWizard);
  private readonly uploads = inject(UploadService);
  private readonly catalogApi = inject(CatalogApi);
  private readonly scanlationApi = inject(ScanlationApi);

  readonly submitting = signal(false);
  readonly progress = signal(0);
  readonly statusText = signal('');
  readonly createdWork = signal<Work | null>(null);
  readonly createdChapterId = signal<string | null>(null);
  readonly createdProjectId = signal<string | null>(null);
  /** CDN URL of the uploaded cover, kept so a retry does not upload it again. */
  private uploadedCoverUrl: string | null = null;

  /** @param existing the series and team to publish into; without it the wizard's series is created first */
  async publish(existing: ExistingSeries | null = null): Promise<void> {
    const wizard = this.wizard;
    const chapterNumber = parseChapterNumber(wizard.draft().chapterNumber);
    if ((!existing && !wizard.seriesValid()) || !wizard.pagesValid() || chapterNumber === null) {
      wizard.showMessage($localize`:@@upload.publish.incomplete:Please complete all required fields before publishing.`);
      return;
    }

    this.submitting.set(true);
    wizard.showMessage(null);
    this.progress.set(5);
    try {
      const work = existing?.work ?? (await this.ensureWork());

      const pending = wizard.pages().filter((p) => p.status !== 'done').length;
      this.progress.set(40);
      this.statusText.set($localize`:@@upload.publish.uploadingPages:Uploading ${pending}:count: chapter pages…`);
      const uploaded = await firstValueFrom(
        this.uploads.uploadPagesBatch(wizard.pages(), `scans/${work.id}/c${chapterNumber}`, 3, (completed, total, item) => {
          wizard.pages.update((pages) => pages.map((p) => (p.id === item.id ? item : p)));
          this.progress.set(40 + Math.floor((completed / total) * 45));
          this.statusText.set($localize`:@@upload.publish.uploadedPages:Uploaded ${completed}:completed:/${total}:total: pages…`);
        })
      );
      const failed = uploaded.filter((p) => p.status !== 'done');
      if (failed.length > 0) {
        const reason = failed[0].error ?? $localize`:@@upload.publish.uploadFailedReason:upload failed`;
        wizard.showMessage(
          $localize`:@@upload.publish.pagesFailed:${failed.length}:failed: of ${uploaded.length}:total: pages failed to upload (${reason}:reason:). Publish again to retry only the failed pages.`
        );
        return;
      }

      this.progress.set(90);
      const project = await this.projectOf(work, existing?.team.id ?? (wizard.draft().teamId || null));
      if (wizard.draft().publishingMode === 'DIRECT') {
        await this.publishDirect(work, project, uploaded, chapterNumber);
      } else {
        await this.createScanlationTask(project, uploaded, chapterNumber);
      }

      this.progress.set(100);
      this.statusText.set($localize`:@@upload.publish.done:Upload completed successfully!`);
      wizard.step.set('success');
    } catch (err: unknown) {
      wizard.showMessage(
        err instanceof UploadFlowError ? err.message : apiErrorMessage(err, $localize`:@@upload.publish.unexpectedError:An unexpected error occurred during upload. Please try again.`)
      );
    } finally {
      this.submitting.set(false);
    }
  }

  /** "Upload another": an empty wizard and nothing remembered from the previous publish. */
  startOver(): void {
    this.createdWork.set(null);
    this.createdChapterId.set(null);
    this.createdProjectId.set(null);
    this.uploadedCoverUrl = null;
    this.progress.set(0);
    this.statusText.set('');
    this.wizard.reset();
  }

  /** Uploads the cover and creates the Work once; later attempts reuse both. */
  private async ensureWork(): Promise<Work> {
    const existing = this.createdWork();
    if (existing) {
      return existing;
    }
    const cover = this.wizard.cover();
    if (cover && !this.uploadedCoverUrl) {
      this.statusText.set($localize`:@@upload.publish.uploadingCover:Uploading cover image…`);
      this.uploadedCoverUrl = (await firstValueFrom(this.uploads.uploadCover(cover.file))).cdnUrl;
    }

    this.progress.set(20);
    this.statusText.set($localize`:@@upload.publish.creatingSeries:Creating series in catalog…`);
    const draft = this.wizard.draft();
    const work = await firstValueFrom(
      this.catalogApi.createWork({
        title: draft.title.trim(),
        synopsis: draft.synopsis.trim(),
        type: draft.type,
        status: draft.status,
        author: draft.author.trim() || undefined,
        demographic: draft.demographic || undefined,
        coverImageUrl: this.uploadedCoverUrl || undefined,
        genres: draft.genres,
        teamId: draft.teamId || undefined
      })
    );
    this.createdWork.set(work);
    return work;
  }

  /**
   * The task board of the publishing team for this series: the named team's, or the only one of a series that was
   * just created. Errors propagate: a failed lookup must be reported, not treated as "no project".
   */
  private async projectOf(work: Work, teamId: string | null): Promise<ScanlationProject> {
    const projects = await firstValueFrom(this.catalogApi.listProjects(work.id));
    const project = teamId ? projects.find((p) => p.teamId === teamId) : projects[0];
    if (!project) {
      throw new UploadFlowError(NO_PROJECT_ERROR);
    }
    return project;
  }

  private async publishDirect(work: Work, project: ScanlationProject, pages: PageUploadItem[], chapterNumber: string): Promise<void> {
    this.statusText.set($localize`:@@upload.publish.publishingDirect:Publishing chapter directly to catalog…`);
    const payload: DirectPublishChapterPayload['pages'] = pages.map((p) => ({
      pageNumber: p.pageNumber,
      storageKey: p.storageKey ?? '',
      cdnUrl: p.cdnUrl ?? '',
      width: p.width,
      height: p.height,
      description: p.description?.trim() || undefined,
      liteCdnUrl: p.liteCdnUrl
    }));
    const chapter = await firstValueFrom(
      this.catalogApi.directPublishChapter(work.id, {
        teamId: project.teamId,
        chapterNumber,
        title: this.wizard.draft().chapterTitle.trim() || undefined,
        pages: payload
      })
    );
    this.createdChapterId.set(chapter.id);
  }

  private async createScanlationTask(project: ScanlationProject, pages: PageUploadItem[], chapterNumber: string): Promise<void> {
    this.statusText.set($localize`:@@upload.publish.attachingRaw:Attaching RAW package to scanlation workspace…`);
    this.createdProjectId.set(project.id);
    await firstValueFrom(
      this.scanlationApi.createTask(project.id, { chapterNumber: Number(chapterNumber), assetUrl: pages[0]?.cdnUrl ?? '', pageCount: pages.length })
    );
  }
}
