import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ScanlationApi } from '@app/core/api/scanlation-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { TASK_STATUS_LABELS, WorkflowTask, canClaim, canPublish, canSubmit, isAssignedTo } from '@app/core/models/scanlation';
import { SeoService } from '@app/core/seo/seo.service';
import { STAGES, tasksByStage, withTask, withTaskStage } from './scanlation-board';
import { PageReportsPanel } from './page-reports-panel/page-reports-panel';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';
import { SubmitWorkDialog } from './submit-work-dialog/submit-work-dialog';

@Component({
  selector: 'app-scanlation-board-page',
  imports: [RouterLink, PageReportsPanel, LoadError, SubmitWorkDialog],
  templateUrl: './scanlation-board-page.html',
  styleUrl: './scanlation-board-page.scss'
})
export class ScanlationBoardPage {
  protected readonly auth = inject(AuthStore);
  protected readonly taskStatusLabels = TASK_STATUS_LABELS;
  private readonly scanlationApi = inject(ScanlationApi);
  private readonly seo = inject(SeoService);

  /** Bound from `scanlation/:projectId`. */
  readonly projectId = input<string | undefined>(undefined);

  /** The project resource is the board's only state: local changes are written back with `project.update(...)`. */
  protected readonly project = this.scanlationApi.projectResource(this.projectId);
  protected readonly currentProject = computed(() => (this.project.hasValue() ? (this.project.value() ?? null) : null));
  /** Claim / submit / publish: `busyKey` is the task being changed. */
  protected readonly action = asyncAction($localize`:@@scanlation.board.actionError:The action could not be completed`);
  /** The task whose work is being submitted, with where its pages go. */
  protected readonly submitTarget = signal<{ task: WorkflowTask; projectId: string; workId: string } | null>(null);

  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);
  /** My roles in the board's team: what I may claim and publish follows them. */
  private readonly myRoles = computed(() => this.currentProject()?.members.find((m) => m.userId === this.currentUserId())?.roles ?? []);

  /** One entry per column, with what the current user may do on each task (computed once, not per template call). */
  protected readonly columns = computed(() => {
    const byStage = tasksByStage(this.currentProject());
    const me = this.currentUserId();
    const roles = this.myRoles();
    return STAGES.map((stage) => ({
      ...stage,
      tasks: byStage[stage.key].map((task) => {
        return {
          task,
          mine: isAssignedTo(task, me),
          canClaim: canClaim(task, roles),
          canSubmit: canSubmit(task, me),
          canPublish: canPublish(task, roles)
        };
      })
    }));
  });

  constructor() {
    this.seo.private_($localize`:@@scanlation.board.seoTitle:Task board`);
  }

  protected async claim(task: WorkflowTask): Promise<void> {
    await this.run(task, async () => {
      const updated = await firstValueFrom(this.scanlationApi.claimTask(this.requireProjectId(), task.id));
      this.project.update((p) => (p ? withTask(p, updated) : p));
    });
  }

  protected openSubmit(task: WorkflowTask): void {
    this.action.clearError();
    this.submitTarget.set({ task, projectId: this.requireProjectId(), workId: this.currentProject()?.workId ?? '' });
  }

  protected closeSubmit(): void {
    this.submitTarget.set(null);
  }

  protected onSubmitted(updated: WorkflowTask): void {
    this.project.update((p) => (p ? withTask(p, updated) : p));
    this.submitTarget.set(null);
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
