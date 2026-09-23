import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ScanlationApi } from '@app/core/api/scanlation-api';
import { WORKFLOW_STAGE_LABELS, WorkflowTask } from '@app/core/models/scanlation';
import { asyncAction } from '@app/core/utils/async-action';
import { PageUploadItem, revokePreviewUrl } from '@app/shared/pages/file-utils';
import { PageGridUploader } from '@app/shared/pages/page-grid-uploader/page-grid-uploader';
import { UploadService, pagePayloadOf } from '@app/shared/pages/upload.service';
import { Dialog } from '@app/shared/ui/dialog/dialog';

/**
 * "Submit work": the member uploads the pages as their stage left them, then the task moves on to the next stage
 * with those pages. A failed page stays in the list and is sent again on the next submit (uploaded ones are not).
 */
@Component({
  selector: 'app-submit-work-dialog',
  imports: [Dialog, PageGridUploader],
  templateUrl: './submit-work-dialog.html',
  styleUrl: './submit-work-dialog.scss'
})
export class SubmitWorkDialog {
  private readonly uploads = inject(UploadService);
  private readonly scanlationApi = inject(ScanlationApi);

  readonly projectId = input.required<string>();
  /** The series: the pages are stored under it. */
  readonly workId = input.required<string>();
  readonly task = input.required<WorkflowTask>();
  /** The task as the server returned it, in its next stage. */
  readonly submitted = output<WorkflowTask>();
  readonly closed = output<void>();

  protected readonly stageLabels = WORKFLOW_STAGE_LABELS;
  protected readonly pages = signal<PageUploadItem[]>([]);
  protected readonly uploaded = signal(0);
  protected readonly action = asyncAction($localize`:@@scanlation.submit.error:The work could not be submitted. Please try again.`);
  constructor() {
    // The pages left in the list belong to this dialog (the uploader's contract): their previews go with it.
    inject(DestroyRef).onDestroy(() => this.pages().forEach((page) => revokePreviewUrl(page.previewUrl)));
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pages().length === 0) {
      this.action.fail($localize`:@@scanlation.submit.noPages:Add the pages of your stage first.`);
      return;
    }
    const task = this.task();
    await this.action.run(async () => {
      this.uploaded.set(0);
      const folder = `scans/${this.workId()}/c${task.chapterNumber}/${task.stage.toLowerCase()}`;
      const settled = await firstValueFrom(this.uploads.uploadPagesBatch(this.pages(), folder, 3, (done) => this.uploaded.set(done)));
      this.pages.set(settled);
      const failed = settled.filter((page) => page.status !== 'done').length;
      if (failed > 0) {
        this.action.fail(
          $localize`:@@scanlation.submit.uploadFailed:Pages not uploaded: ${failed}:count:. Submit again to send them.`
        );
        return;
      }
      const updated = await firstValueFrom(this.scanlationApi.submitTask(this.projectId(), task.id, { pages: pagePayloadOf(settled) }));
      this.submitted.emit(updated);
    });
  }
}
