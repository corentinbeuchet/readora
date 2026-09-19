import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form, min, pattern, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { ScanlationApi } from '@app/core/api/scanlation-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { Dialog } from '@app/shared/ui/dialog/dialog';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { TASK_STATUS_LABELS, WorkflowTask, canClaim, canPublish, canSubmit, isAssignedTo } from '@app/core/models/scanlation';
import { SeoService } from '@app/core/seo/seo.service';
import { STAGES, STAGE_LABELS, tasksByStage, withTask, withTaskStage } from './scanlation-board';
import { PageReportsPanel } from './page-reports-panel/page-reports-panel';
import { asyncAction } from '@app/core/utils/async-action';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';

interface SubmitModel {
  assetUrl: string;
  pageCount: number;
}

@Component({
  selector: 'app-scanlation-board-page',
  imports: [FieldErrors, AriaInvalidDirective, RouterLink, FormField, HasPermissionDirective, Dialog, PageReportsPanel],
  templateUrl: './scanlation-board-page.html',
  styleUrl: './scanlation-board-page.scss'
})
export class ScanlationBoardPage {
  protected readonly auth = inject(AuthStore);
  protected readonly taskStatusLabels = TASK_STATUS_LABELS;
  protected readonly stageLabels = STAGE_LABELS;
  private readonly scanlationApi = inject(ScanlationApi);
  private readonly seo = inject(SeoService);

  /** Bound from `scanlation/:projectId`. */
  readonly projectId = input<string | undefined>(undefined);

  /** The project resource is the board's only state: local changes are written back with `project.update(...)`. */
  protected readonly project = this.scanlationApi.projectResource(this.projectId);
  protected readonly currentProject = computed(() => (this.project.hasValue() ? (this.project.value() ?? null) : null));
  /** Claim / submit / publish: `busyKey` is the task being changed. */
  protected readonly action = asyncAction($localize`:@@scanlation.board.actionError:The action could not be completed`);
  protected readonly submitTarget = signal<WorkflowTask | null>(null);

  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  /** One entry per column, with what the current user may do on each task (computed once, not per template call). */
  protected readonly columns = computed(() => {
    const byStage = tasksByStage(this.currentProject());
    const me = this.currentUserId();
    return STAGES.map((stage) => ({
      ...stage,
      tasks: byStage[stage.key].map((task) => {
        return {
          task,
          mine: isAssignedTo(task, me),
          canClaim: canClaim(task),
          canSubmit: canSubmit(task, me),
          canPublish: canPublish(task)
        };
      })
    }));
  });

  protected readonly submitModel = signal<SubmitModel>({ assetUrl: '', pageCount: 1 });
  protected readonly submitForm = form(this.submitModel, (path) => {
    required(path.assetUrl, { message: $localize`:@@scanlation.submit.assetUrl.required:Asset package URL is required` });
    pattern(path.assetUrl, /^https?:\/\/\S+$/, { message: $localize`:@@scanlation.submit.assetUrl.pattern:Must be an http(s) URL` });
    min(path.pageCount, 1, { message: $localize`:@@scanlation.submit.pageCount.min:Page count must be at least 1` });
  });

  constructor() {
    this.seo.private_($localize`:@@scanlation.board.seoTitle:Scanlation workspace`);
  }

  protected async claim(task: WorkflowTask): Promise<void> {
    await this.run(task, async () => {
      const updated = await firstValueFrom(this.scanlationApi.claimTask(this.requireProjectId(), task.id));
      this.project.update((p) => (p ? withTask(p, updated) : p));
    });
  }

  protected openSubmit(task: WorkflowTask): void {
    this.action.clearError();
    this.submitModel.set({ assetUrl: task.assetPackageUrl ?? '', pageCount: task.pageCount || 1 });
    this.submitTarget.set(task);
  }

  protected closeSubmit(): void {
    this.submitTarget.set(null);
  }

  protected async onSubmitWork(event: Event): Promise<void> {
    event.preventDefault();
    const task = this.submitTarget();
    if (!task) {
      return;
    }
    await submit(this.submitForm, async (f) => {
      await this.run(task, async () => {
        const { assetUrl, pageCount } = f().value();
        const updated = await firstValueFrom(
          this.scanlationApi.submitTask(this.requireProjectId(), task.id, { assetUrl, pageCount })
        );
        this.project.update((p) => (p ? withTask(p, updated) : p));
        this.submitTarget.set(null);
      });
    });
  }

  protected async publish(task: WorkflowTask): Promise<void> {
    await this.run(task, async () => {
      await firstValueFrom(this.scanlationApi.publishTask(this.requireProjectId(), task.id));
      this.project.update((p) => (p ? withTaskStage(p, task.id, 'PUBLISHED', 'COMPLETED', new Date()) : p));
    });
  }

  protected reload(): void {
    this.project.reload();
  }

  private async run(task: WorkflowTask, action: () => Promise<void>): Promise<void> {
    await this.action.run(action, { key: task.id });
  }

  private requireProjectId(): string {
    const id = this.projectId() ?? this.currentProject()?.id;
    if (!id) {
      throw new Error('No project selected');
    }
    return id;
  }
}
