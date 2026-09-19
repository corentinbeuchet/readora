import { Service, computed, signal } from '@angular/core';
import { ScanlationProject, WorkflowTask, WorkflowStage, TaskStatus } from '@app/core/models/readora.models';

/**
 * State of the project shown by one Kanban board. Page-scoped: provided by `KanbanBoard`
 * (`providers: [ScanlationState]`), so it starts empty on every board and never shows the
 * previous project's tasks.
 */
@Service({ autoProvided: false })
export class ScanlationState {
  private readonly _currentProject = signal<ScanlationProject | null>(null);

  readonly currentProject = this._currentProject.asReadonly();

  readonly tasksByStage = computed(() => {
    const project = this._currentProject();
    const map: Record<WorkflowStage, WorkflowTask[]> = {
      RAW_UPLOADED: [],
      CLEANING: [],
      TRANSLATING: [],
      TYPESETTING: [],
      PROOFREADING: [],
      QC_REVIEW: [],
      PUBLISHED: []
    };

    if (!project) return map;

    for (const task of project.tasks) {
      if (map[task.stage]) {
        map[task.stage].push(task);
      }
    }
    return map;
  });

  setProject(project: ScanlationProject): void {
    this._currentProject.set(project);
  }

  clear(): void {
    this._currentProject.set(null);
  }

  /** Replaces a task with the version returned by the API. */
  upsertTask(task: WorkflowTask): void {
    this._currentProject.update(project => {
      if (!project) return null;
      const exists = project.tasks.some(t => t.id === task.id);
      const tasks = exists ? project.tasks.map(t => (t.id === task.id ? task : t)) : [...project.tasks, task];
      return { ...project, tasks };
    });
  }

  updateTaskStage(taskId: string, nextStage: WorkflowStage, status: TaskStatus = 'PENDING'): void {
    this._currentProject.update(project => {
      if (!project) return null;
      const updatedTasks = project.tasks.map(t =>
        t.id === taskId ? { ...t, stage: nextStage, status, updatedAt: new Date().toISOString() } : t
      );
      return { ...project, tasks: updatedTasks };
    });
  }
}
