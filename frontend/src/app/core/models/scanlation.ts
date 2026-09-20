export type ScanlationRole = 'LEADER' | 'CLEANER_REDRAWER' | 'TRANSLATOR' | 'TYPESETTER' | 'PROOFREADER' | 'QUALITY_CHECKER';

export type WorkflowStage = 'RAW_UPLOADED' | 'CLEANING' | 'TRANSLATING' | 'TYPESETTING' | 'PROOFREADING' | 'QC_REVIEW' | 'PUBLISHED';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: $localize`:@@taskStatus.pending:Pending`,
  IN_PROGRESS: $localize`:@@taskStatus.inProgress:In progress`,
  COMPLETED: $localize`:@@taskStatus.completed:Completed`
};

export interface WorkflowTask {
  id: string;
  chapterNumber: string;
  stage: WorkflowStage;
  status: TaskStatus;
  assigneeId: string | null;
  assetPackageUrl: string | null;
  pageCount: number;
  updatedAt: string;
}

export interface ScanlationProject {
  id: string;
  name: string;
  workId: string;
  teamId: string;
  teamName: string;
  /** The roster of the project's team: roles apply to every series the team works on. */
  members: { userId: string; roles: ScanlationRole[] }[];
  tasks: WorkflowTask[];
}

export interface SubmitTaskRequest {
  assetUrl: string;
  pageCount: number;
}

export interface CreateTaskRequest {
  chapterNumber: number;
  assetUrl: string;
  pageCount: number;
}

/** An open task nobody holds yet; published or completed work can't be claimed. */
export function canClaim(task: WorkflowTask): boolean {
  return task.stage !== 'PUBLISHED' && task.status !== 'COMPLETED' && !task.assigneeId;
}

/** Only the assignee submits, and QC review ends with a publish, not a submit. */
export function canSubmit(task: WorkflowTask, userId: string | null): boolean {
  return task.stage !== 'PUBLISHED' && task.stage !== 'QC_REVIEW' && isAssignedTo(task, userId);
}

/** A chapter is published from the QC review stage. */
export function canPublish(task: WorkflowTask): boolean {
  return task.stage === 'QC_REVIEW';
}

export function isAssignedTo(task: WorkflowTask, userId: string | null): boolean {
  return !!task.assigneeId && task.assigneeId === userId;
}
