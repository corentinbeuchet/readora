import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form, min, pattern, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { ScanlationApi } from '@app/core/api/scanlation-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { FocusTrapDirective } from '@app/core/a11y/focus-trap.directive';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { WorkflowStage, WorkflowTask } from '@app/core/models/readora.models';
import { SeoService } from '@app/core/seo/seo.service';
import { AnyField, apiErrorMessage, visibleErrors } from '@app/features/auth/auth-form.utils';
import { ScanlationState } from '../services/scanlation-state';

interface SubmitModel {
  assetUrl: string;
  pageCount: number;
}

@Component({
  selector: 'app-kanban-board',
  imports: [RouterLink, FormField, HasPermissionDirective, FocusTrapDirective],
  templateUrl: './kanban-board.html',
  styleUrl: './kanban-board.scss',
  // Page-scoped state: a fresh ScanlationState per board, discarded on navigation.
  providers: [ScanlationState],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KanbanBoard {
  readonly state = inject(ScanlationState);
  protected readonly auth = inject(AuthStore);
  private readonly scanlationApi = inject(ScanlationApi);
  private readonly seo = inject(SeoService);

  /** Bound from `scanlation/:projectId`. */
  readonly projectId = input<string | undefined>(undefined);

  protected readonly project = this.scanlationApi.projectResource(this.projectId);
  protected readonly busyTaskId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly submitTarget = signal<WorkflowTask | null>(null);

  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  readonly stages: { key: WorkflowStage; label: string }[] = [
    { key: 'RAW_UPLOADED', label: 'RAW Package' },
    { key: 'CLEANING', label: 'Cleaning & Redraw' },
    { key: 'TRANSLATING', label: 'Translation' },
    { key: 'TYPESETTING', label: 'Typesetting' },
    { key: 'PROOFREADING', label: 'Proofreading' },
    { key: 'QC_REVIEW', label: 'QC Review' },
    { key: 'PUBLISHED', label: 'Published' }
  ];

  protected readonly submitModel = signal<SubmitModel>({ assetUrl: '', pageCount: 1 });
  protected readonly submitForm = form(this.submitModel, (path) => {
    required(path.assetUrl, { message: 'Asset package URL is required' });
    pattern(path.assetUrl, /^https?:\/\/\S+$/, { message: 'Must be an http(s) URL' });
    min(path.pageCount, 1, { message: 'Page count must be at least 1' });
  });

  constructor() {
    this.seo.private_('Scanlation workspace');
    effect(() => {
      const id = this.projectId();
      // `value()` throws while the resource is in error state: check `hasValue()` first.
      const loaded = this.project.hasValue() ? this.project.value() : undefined;
      untracked(() => {
        if (loaded && loaded.id === id) {
          this.state.setProject(loaded);
        } else if (this.state.currentProject()?.id !== id || this.project.error()) {
          // Another project is loading, or it failed: never keep showing the previous project.
          this.state.clear();
        }
      });
    });
  }

  protected errors(field: AnyField): string[] {
    return visibleErrors(field);
  }

  protected isMine(task: WorkflowTask): boolean {
    return !!task.assigneeId && task.assigneeId === this.currentUserId();
  }

  protected canClaim(task: WorkflowTask): boolean {
    return task.stage !== 'PUBLISHED' && task.status !== 'COMPLETED' && !task.assigneeId;
  }

  protected canSubmit(task: WorkflowTask): boolean {
    return task.stage !== 'PUBLISHED' && task.stage !== 'QC_REVIEW' && this.isMine(task);
  }

  protected canPublish(task: WorkflowTask): boolean {
    return task.stage === 'QC_REVIEW';
  }

  protected async claim(task: WorkflowTask): Promise<void> {
    await this.run(task, async () => {
      const updated = await firstValueFrom(this.scanlationApi.claimTask(this.requireProjectId(), task.id));
      this.state.upsertTask(updated);
    });
  }

  protected openSubmit(task: WorkflowTask): void {
    this.actionError.set(null);
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
        this.state.upsertTask(updated);
        this.submitTarget.set(null);
      });
    });
  }

  protected async publish(task: WorkflowTask): Promise<void> {
    await this.run(task, async () => {
      await firstValueFrom(this.scanlationApi.publishTask(this.requireProjectId(), task.id));
      this.state.updateTaskStage(task.id, 'PUBLISHED', 'COMPLETED');
    });
  }

  protected reload(): void {
    this.project.reload();
  }

  private async run(task: WorkflowTask, action: () => Promise<void>): Promise<void> {
    this.actionError.set(null);
    this.busyTaskId.set(task.id);
    try {
      await action();
    } catch (error) {
      this.actionError.set(apiErrorMessage(error, 'The action could not be completed'));
    } finally {
      this.busyTaskId.set(null);
    }
  }

  private requireProjectId(): string {
    const id = this.projectId() ?? this.state.currentProject()?.id;
    if (!id) {
      throw new Error('No project selected');
    }
    return id;
  }
}
