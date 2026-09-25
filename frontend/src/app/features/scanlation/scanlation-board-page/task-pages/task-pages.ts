import { Component, inject, input } from '@angular/core';
import { ScanlationApi } from '@app/core/api/scanlation-api';
import { LoadError } from '@app/shared/ui/load-error';

/**
 * The pages of one task, as its last stage left them (US-02): the board only sends page counts, so the pages load
 * when a member opens the task's list.
 */
@Component({
  selector: 'app-task-pages',
  imports: [LoadError],
  templateUrl: './task-pages.html',
  styleUrl: './task-pages.scss'
})
export class TaskPages {
  private readonly api = inject(ScanlationApi);

  readonly projectId = input.required<string>();
  readonly taskId = input.required<string>();

  protected readonly pages = this.api.taskPagesResource(this.projectId, this.taskId);
}
