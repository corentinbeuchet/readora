import { PageAsset, PagePayload } from '@app/core/models/chapter';


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

/** Display names of the workflow stages, in workflow order (the task board's columns). */
export const WORKFLOW_STAGE_LABELS: Record<WorkflowStage, string> = {
  RAW_UPLOADED: $localize`:@@scanlation.board.stage.raw:RAW Package`,
  CLEANING: $localize`:@@scanlation.board.stage.cleaning:Cleaning & Redraw`,
  TRANSLATING: $localize`:@@scanlation.board.stage.translating:Translation`,
  TYPESETTING: $localize`:@@scanlation.board.stage.typesetting:Typesetting`,
  PROOFREADING: $localize`:@@scanlation.board.stage.proofreading:Proofreading`,
  QC_REVIEW: $localize`:@@scanlation.board.stage.qcReview:QC Review`,
  PUBLISHED: $localize`:@@scanlation.board.stage.published:Published`
};

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
  /** Who holds the task, by username; `null` when nobody does (or the account is gone). */
  assigneeUsername: string | null;
  pageCount: number;
  /** The pages as the last stage left them (the raw pages at first); the next stage starts from them. */
  pages: PageAsset[];
  updatedAt: string;
}

export interface ScanlationProject {
  id: string;
  name: string;
  workId: string;
  teamId: string;
  teamName: string;
  /** The team uses the task board for this series (off by default: most teams publish finished chapters). */
  boardEnabled: boolean;
  /** The roster of the project's team: roles apply to every series the team works on. */
  members: { userId: string; username: string | null; roles: ScanlationRole[] }[];
  tasks: WorkflowTask[];
}

/** A series named by a list that only links to it (backend `SeriesRefDto`). */
export interface SeriesRef {
  id: string;
  title: string;
}

/** One of a team's series, with its task board (`boardEnabled`: the team uses it). */
export interface TeamBoard {
  projectId: string;
  work: SeriesRef;
  boardEnabled: boolean;
}

/** A team I belong to (`GET /teams/mine`), with my roles in it. */
export interface MyTeam {
  id: string;
  name: string;
  description: string | null;
  myRoles: ScanlationRole[];
  boards: TeamBoard[];
}

/** A task of one of my teams' boards that I hold (`mine`) or can take on (`GET /teams/mine/tasks`). */
export interface WaitingTask {
  projectId: string;
  work: SeriesRef;
  team: { id: string; name: string };
  taskId: string;
  chapterNumber: string;
  stage: WorkflowStage;
  mine: boolean;
}

/** An invitation to join a team (US-12): the reader joins only by accepting it. */
export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName: string;
  /** Username of the invited reader. */
  invitee: string;
  roles: ScanlationRole[];
  /** Username of the leader who sent it. */
  invitedBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
}

/** Leaders add series and members; the server enforces it too. */
export function leadsTeam(team: MyTeam): boolean {
  return team.myRoles.includes('LEADER');
}

/** Leaders and quality checkers publish the team's chapters; the server enforces it too. */
export function publishesForTeam(team: MyTeam): boolean {
  return leadsTeam(team) || team.myRoles.includes('QUALITY_CHECKER');
}

/** The pages of the stage just done: they replace the task's pages. */
export interface SubmitTaskRequest {
  pages: PagePayload[];
}

/** A chapter goes on the board with its raw pages. */
export interface CreateTaskRequest {
  chapterNumber: number;
  pages: PagePayload[];
}

/** The team role that works on each stage (backend `WorkflowStage.requiredRole`). */
const STAGE_ROLE: Record<WorkflowStage, ScanlationRole> = {
  RAW_UPLOADED: 'CLEANER_REDRAWER',
  CLEANING: 'CLEANER_REDRAWER',
  TRANSLATING: 'TRANSLATOR',
  TYPESETTING: 'TYPESETTER',
  PROOFREADING: 'PROOFREADER',
  QC_REVIEW: 'QUALITY_CHECKER',
  PUBLISHED: 'QUALITY_CHECKER'
};

/** A member works on a stage with its role; a leader counts as every role. The server enforces it too. */
export function worksOnStage(roles: readonly ScanlationRole[], stage: WorkflowStage): boolean {
  return roles.includes('LEADER') || roles.includes(STAGE_ROLE[stage]);
}

/** An open task nobody holds yet, in a stage I work on; published or completed work can't be claimed. */
export function canClaim(task: WorkflowTask, myRoles: readonly ScanlationRole[]): boolean {
  return task.stage !== 'PUBLISHED' && task.status !== 'COMPLETED' && !task.assigneeId && worksOnStage(myRoles, task.stage);
}

/** Only the assignee submits, and QC review ends with a publish, not a submit. */
export function canSubmit(task: WorkflowTask, userId: string | null): boolean {
  return task.stage !== 'PUBLISHED' && task.stage !== 'QC_REVIEW' && isAssignedTo(task, userId);
}

/** A chapter is published from the QC review stage, by a quality checker or a leader. */
export function canPublish(task: WorkflowTask, myRoles: readonly ScanlationRole[]): boolean {
  return task.stage === 'QC_REVIEW' && worksOnStage(myRoles, task.stage);
}

export function isAssignedTo(task: WorkflowTask, userId: string | null): boolean {
  return !!task.assigneeId && task.assigneeId === userId;
}
