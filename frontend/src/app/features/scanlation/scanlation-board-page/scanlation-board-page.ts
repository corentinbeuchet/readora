import { Icon } from '@app/shared/ui/icon/icon';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ScanlationApi } from '@app/core/api/scanlation-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { TASK_STATUS_LABELS, WorkflowTask, canClaim, canPublish, canSubmit, isAssignedTo } from '@app/core/models/scanlation';
import { SeoService } from '@app/core/seo/seo.service';
import { LATEST_PUBLISHED, STAGES, latestFirst, tasksByStage, withTask, withTaskStage } from './scanlation-board';
import { PageReportsPanel } from './page-reports-panel/page-reports-panel';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';
import { SubmitWorkDialog } from './submit-work-dialog/submit-work-dialog';
import { TaskPages } from './task-pages/task-pages';

@Component({
  selector: 'app-scanlation-board-page',
  imports: [Icon, RouterLink, PageReportsPanel, LoadError, SubmitWorkDialog, TaskPages],
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
  /** What the last Publish did (out, or waiting for a moderator), announced politely. */
  protected readonly published = signal('');
  /** The task whose work is being submitted, with where its pages go. */
  protected readonly submitTarget = signal<{ task: WorkflowTask; projectId: string; workId: string } | null>(null);

  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);
  /** My roles in the board's team: what I may claim and publish follows them. */
  private readonly myRoles = computed(() => this.currentProject()?.members.find((m) => m.userId === this.currentUserId())?.roles ?? []);

  /** The tasks whose list of pages is open: their pages are asked for then, not with the board. */
  protected readonly openPages = signal<ReadonlySet<string>>(new Set());
  /** The published column shows the latest chapters until a member asks for the older ones. */
  protected readonly showOlderPublished = signal(false);
  protected readonly latestPublished = LATEST_PUBLISHED;

  /** One entry per column, with what the current user may do on each task (computed once, not per template call). */
  protected readonly columns = computed(() => {
    const byStage = tasksByStage(this.currentProject());
    const me = this.currentUserId();
    const roles = this.myRoles();
    return STAGES.map((stage) => {
      const published = stage.key === 'PUBLISHED';
      const all = published ? latestFirst(byStage[stage.key]) : byStage[stage.key];
      const shown = published && !this.showOlderPublished() ? all.slice(0, LATEST_PUBLISHED) : all;
      return {
        ...stage,
        total: all.length,
        olderCount: published ? Math.max(0, all.length - LATEST_PUBLISHED) : 0,
        tasks: shown.map((task) => ({
          task,
          mine: isAssignedTo(task, me),
          canClaim: canClaim(task, roles),
          canSubmit: canSubmit(task, me),
          canPublish: canPublish(task, roles)
        }))
      };
    });
  });

  constructor() {
    this.seo.private_($localize`:@@scanlation.board.seoTitle:Task board`);
  }

  protected showPages(taskId: string, open: boolean): void {
    this.openPages.update((ids) => {
      const next = new Set(ids);
      if (open) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
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
    this.published.set('');
    await this.run(task, async () => {
      const outcome = await firstValueFrom(this.scanlationApi.publishTask(this.requireProjectId(), task.id));
      this.project.update((p) => (p ? withTaskStage(p, task.id, 'PUBLISHED', 'COMPLETED', new Date()) : p));
      this.published.set(
        outcome.status === 'PENDING_REVIEW'
          ? $localize`:@@scanlation.board.sentForReview:Chapter ${task.chapterNumber}:number: is the team's first: a moderator checks it before readers see it.`
          : $localize`:@@scanlation.board.publishedNow:Chapter ${task.chapterNumber}:number: is out.`
      );
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
