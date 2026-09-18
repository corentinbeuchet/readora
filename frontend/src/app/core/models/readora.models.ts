export type WorkType = 'MANGA' | 'MANHWA' | 'MANHUA' | 'COMIC';
export type WorkStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS';

export interface Work {
  id: string;
  title: string;
  synopsis: string;
  type: WorkType;
  status: WorkStatus;
  coverImageUrl: string;
  genres: string[];
}

export interface CreateWorkPayload {
  title: string;
  synopsis: string;
  type: WorkType;
  status: WorkStatus;
  coverImageUrl?: string;
  genres: string[];
}

export interface DirectPublishChapterPayload {
  chapterNumber: string;
  title?: string;
  pages: {
    pageNumber: number;
    storageKey: string;
    cdnUrl?: string;
    width?: number;
    height?: number;
  }[];
}

export interface StorageUploadResult {
  storageKey: string;
  cdnUrl: string;
}

export interface PageAsset {
  pageNumber: number;
  storageKey: string;
  cdnUrl: string;
  width?: number;
  height?: number;
}

export interface Chapter {
  id: string;
  workId: string;
  chapterNumber: string;
  title: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  pages: PageAsset[];
  scanlationProjectId?: string;
  publishedAt?: string;
}

export type ScanlationRole = 'LEADER' | 'CLEANER_REDRAWER' | 'TRANSLATOR' | 'TYPESETTER' | 'PROOFREADER' | 'QUALITY_CHECKER';
export type WorkflowStage = 'RAW_UPLOADED' | 'CLEANING' | 'TRANSLATING' | 'TYPESETTING' | 'PROOFREADING' | 'QC_REVIEW' | 'PUBLISHED';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export interface WorkflowTask {
  id: string;
  chapterNumber: string;
  stage: WorkflowStage;
  status: TaskStatus;
  assigneeId?: string;
  assetPackageUrl?: string;
  pageCount: number;
  updatedAt: string;
}

export interface ScanlationProject {
  id: string;
  name: string;
  workId: string;
  members: { userId: string; roles: ScanlationRole[] }[];
  tasks: WorkflowTask[];
}

export interface ChapterComment {
  id: string;
  chapterId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  pageReference?: number;
  parentId?: string;
  depth: number;
  isSpoiler: boolean;
  upvotes: number;
  createdAt: string;
}

/** Result of `POST /comments/{id}/upvote`: one vote per user, so `counted` is false on a repeat. */
export interface CommentUpvote {
  commentId: string;
  upvotes: number;
  counted: boolean;
}

// ---------------------------------------------------------------------------
// API envelope & pagination
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Identity, permissions & subscriptions
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  'COMMENT_WRITE',
  'COMMENT_UPVOTE',
  'BOOKMARK_READ',
  'BOOKMARK_WRITE',
  'TASK_CLAIM',
  'TASK_SUBMIT',
  'CHAPTER_PUBLISH',
  'PROJECT_VIEW',
  'PROJECT_MANAGE',
  'USER_MANAGE',
  'WORK_CREATE'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'READER' | 'SCANLATOR' | 'ADMIN';
export type SubscriptionPlan = 'FREE' | 'PREMIUM';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  active: boolean;
  currentPeriodEnd?: string | null;
  planPermissions: Permission[];
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string | null;
  roles: Role[];
  permissions: Permission[];
  subscription: Subscription;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserProfile;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Catalog & bookmarks
// ---------------------------------------------------------------------------

export interface WorkSummary {
  id: string;
  title: string;
  type: Work['type'];
  status: Work['status'];
  coverImageUrl: string;
  genres: string[];
}

export interface ChapterSummary {
  id: string;
  workId: string;
  chapterNumber: string;
  title: string;
  status: Chapter['status'];
  pageCount: number;
  publishedAt?: string | null;
}

export type BookmarkStatus = 'READING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED' | 'PLAN_TO_READ';

export interface Bookmark {
  workId: string;
  lastReadChapterId?: string | null;
  lastReadPageIndex: number;
  status: BookmarkStatus;
  updatedAt: string;
}

export interface UpdateProgressRequest {
  chapterId: string;
  pageIndex: number;
}

export interface CreateCommentRequest {
  content: string;
  pageReference?: number | null;
  parentId?: string | null;
  isSpoiler: boolean;
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
