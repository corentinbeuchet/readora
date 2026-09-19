import { ScanlationProject, TaskStatus, WorkflowStage, WorkflowTask } from '@app/core/models/scanlation';

/** Board columns, in workflow order. */
export const STAGES: readonly { key: WorkflowStage; label: string }[] = [
  { key: 'RAW_UPLOADED', label: $localize`:@@scanlation.board.stage.raw:RAW Package` },
  { key: 'CLEANING', label: $localize`:@@scanlation.board.stage.cleaning:Cleaning & Redraw` },
  { key: 'TRANSLATING', label: $localize`:@@scanlation.board.stage.translating:Translation` },
  { key: 'TYPESETTING', label: $localize`:@@scanlation.board.stage.typesetting:Typesetting` },
  { key: 'PROOFREADING', label: $localize`:@@scanlation.board.stage.proofreading:Proofreading` },
  { key: 'QC_REVIEW', label: $localize`:@@scanlation.board.stage.qcReview:QC Review` },
  { key: 'PUBLISHED', label: $localize`:@@scanlation.board.stage.published:Published` }
];

/** The project's tasks grouped by workflow stage (every stage present, possibly empty). */
export function tasksByStage(project: ScanlationProject | null): Record<WorkflowStage, WorkflowTask[]> {
  const map = Object.fromEntries(STAGES.map((s) => [s.key, [] as WorkflowTask[]])) as Record<WorkflowStage, WorkflowTask[]>;
  for (const task of project?.tasks ?? []) {
    map[task.stage]?.push(task);
  }
  return map;
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
