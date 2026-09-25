import { ScanlationProject, TaskStatus, WORKFLOW_STAGE_LABELS, WorkflowStage, WorkflowTask } from '@app/core/models/scanlation';

/** Board columns, in workflow order. */
export const STAGES: readonly { key: WorkflowStage; label: string }[] = (Object.keys(WORKFLOW_STAGE_LABELS) as WorkflowStage[]).map((key) => ({
  key,
  label: WORKFLOW_STAGE_LABELS[key]
}));

/** The project's tasks grouped by workflow stage (every stage present, possibly empty). */
export function tasksByStage(project: ScanlationProject | null): Record<WorkflowStage, WorkflowTask[]> {
  const map = Object.fromEntries(STAGES.map((s) => [s.key, [] as WorkflowTask[]])) as Record<WorkflowStage, WorkflowTask[]>;
  for (const task of project?.tasks ?? []) {
    map[task.stage]?.push(task);
  }
  return map;
}

/** How many published chapters the last column shows before "Show older chapters". */
export const LATEST_PUBLISHED = 10;

/** Published tasks, the most recently published first: the column keeps every chapter the board ever published. */
export function latestFirst(tasks: readonly WorkflowTask[]): WorkflowTask[] {
  return [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** The project with `task` replaced by the version the API returned (appended if new). */
export function withTask(project: ScanlationProject, task: WorkflowTask): ScanlationProject {
  const exists = project.tasks.some((t) => t.id === task.id);
  return { ...project, tasks: exists ? project.tasks.map((t) => (t.id === task.id ? task : t)) : [...project.tasks, task] };
}

/** The project with one task moved to another stage. */
export function withTaskStage(project: ScanlationProject, taskId: string, stage: WorkflowStage, status: TaskStatus, at: Date): ScanlationProject {
  return {
    ...project,
    tasks: project.tasks.map((t) => (t.id === taskId ? { ...t, stage, status, updatedAt: at.toISOString() } : t))
  };
}
