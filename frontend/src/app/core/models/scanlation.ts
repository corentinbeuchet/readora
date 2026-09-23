
export type ScanlationRole = 'LEADER' | 'CLEANER_REDRAWER' | 'TRANSLATOR' | 'TYPESETTER' | 'PROOFREADER' | 'QUALITY_CHECKER';

export const SCANLATION_ROLES: readonly ScanlationRole[] = ['LEADER', 'CLEANER_REDRAWER', 'TRANSLATOR', 'TYPESETTER', 'PROOFREADER', 'QUALITY_CHECKER'];

export const SCANLATION_ROLE_LABELS: Record<ScanlationRole, string> = {
  LEADER: $localize`:@@scanlationRole.leader:Leader`,
  CLEANER_REDRAWER: $localize`:@@scanlationRole.cleaner:Cleaner`,
  TRANSLATOR: $localize`:@@scanlationRole.translator:Translator`,
  TYPESETTER: $localize`:@@scanlationRole.typesetter:Typesetter`,
  PROOFREADER: $localize`:@@scanlationRole.proofreader:Proofreader`,
  QUALITY_CHECKER: $localize`:@@scanlationRole.qualityChecker:Quality checker`
};

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

/** A series named by a list that only links to it (backend `SeriesRefDto`). */
export interface SeriesRef {
  id: string;
  title: string;
}

/** One of a team's task boards, with the series it is for. */
export interface TeamBoard {
  projectId: string;
  work: SeriesRef;
}

/** A team I belong to (`GET /teams/mine`), with my roles in it. */
export interface MyTeam {
  id: string;
  name: string;
  description: string | null;
  myRoles: ScanlationRole[];
  boards: TeamBoard[];
}

/** Leaders add series and members; the server enforces it too. */
export function leadsTeam(team: MyTeam): boolean {
  return team.myRoles.includes('LEADER');
}

/** Leaders and quality checkers publish the team's chapters; the server enforces it too. */
export function publishesForTeam(team: MyTeam): boolean {
  return leadsTeam(team) || team.myRoles.includes('QUALITY_CHECKER');
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
