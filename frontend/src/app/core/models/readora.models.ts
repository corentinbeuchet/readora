export type WorkType = 'MANGA' | 'MANHWA' | 'MANHUA' | 'COMIC';
export type WorkStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS';
export type Demographic = 'SHOUNEN' | 'SHOUJO' | 'SEINEN' | 'JOSEI';

export interface Work {
  id: string;
  title: string;
  synopsis: string;
  type: WorkType;
  status: WorkStatus;
  author?: string | null;
  demographic?: Demographic | null;
  coverImageUrl: string;
  genres: string[];
}

export interface CreateWorkPayload {
  title: string;
  synopsis: string;
  type: WorkType;
  status: WorkStatus;
  author?: string;
  demographic?: Demographic;
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
  /** Reader view only (`GET /chapters/{id}`): the series, for its title and default reading mode. */
  work?: { id: string; title: string; type: WorkType } | null;
  /** Reader view only: published neighbours, `null` at either end. */
  previousChapterId?: string | null;
  nextChapterId?: string | null;
}

export type ScanlationRole = 'LEADER' | 'CLEANER_REDRAWER' | 'TRANSLATOR' | 'TYPESETTER' | 'PROOFREADER' | 'QUALITY_CHECKER';
export type WorkflowStage = 'RAW_UPLOADED' | 'CLEANING' | 'TRANSLATING' | 'TYPESETTING' | 'PROOFREADING' | 'QC_REVIEW' | 'PUBLISHED';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

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
  'WORK_CREATE',
  'LIBRARY_USE',
  'PAGE_REPORT',
  'RATE_WORK'
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
  /** Renewal stopped: access continues until `currentPeriodEnd`, then the plan ends. */
  cancelAtPeriodEnd?: boolean;
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
  author?: string | null;
  demographic?: Demographic | null;
  coverImageUrl: string;
  genres: string[];
}

/** Catalog filters (`GET /works`). Every `genres` entry is required, no `excludedGenres` entry may be present. */
export interface CatalogQuery {
  text?: string;
  genres?: readonly string[];
  excludedGenres?: readonly string[];
  type?: WorkType;
  status?: WorkStatus;
  demographic?: Demographic;
  page: number;
  size: number;
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

// ---------------------------------------------------------------------------
// Library & reading history (free for signed-in readers: LIBRARY_USE)
// ---------------------------------------------------------------------------

export type ReadingStatus = 'READING' | 'PLAN_TO_READ' | 'COMPLETED' | 'DROPPED';

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  READING: 'Reading',
  PLAN_TO_READ: 'Plan to read',
  COMPLETED: 'Completed',
  DROPPED: 'Dropped'
};

export interface LibraryEntry {
  workId: string;
  status: ReadingStatus;
  addedAt: string;
  updatedAt: string;
}

export interface LibraryItem {
  work: WorkSummary;
  status: ReadingStatus;
  addedAt: string;
  updatedAt: string;
  /** Chapters published since the reader last read this series. */
  newChapters: number;
}

export interface ChapterRead {
  chapterId: string;
  workId: string;
  chapterNumber: string;
  readAt: string;
  finished: boolean;
}

export interface HistoryItem {
  work: WorkSummary;
  lastRead: ChapterRead;
}

// ---------------------------------------------------------------------------
// Latest updates & rankings (US-08)
// ---------------------------------------------------------------------------

export interface Release {
  work: WorkSummary;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  publishedAt: string;
  /** Finished by the signed-in reader (always false for guests). */
  read: boolean;
}

export type RankingPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export interface RankedWork {
  rank: number;
  work: WorkSummary;
  /** Popularity score, or average rating for top rated. */
  score: number;
  /** Number of ratings (top rated only). */
  ratings: number;
}

// ---------------------------------------------------------------------------
// Ratings & reviews (US-09)
// ---------------------------------------------------------------------------

export interface RatingSummary {
  /** One decimal; 0 without ratings. */
  average: number;
  count: number;
}

export interface MyRating {
  id: string;
  workId: string;
  score: number;
  liked?: string | null;
  disliked?: string | null;
  verdict?: string | null;
}

export interface ReviewPayload {
  score: number;
  liked?: string;
  disliked?: string;
  verdict: string;
}

export interface WorkReview {
  id: string;
  authorId: string;
  authorUsername: string;
  score: number;
  liked?: string | null;
  disliked?: string | null;
  verdict: string;
  helpfulVotes: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Broken-page reports (US-06)
// ---------------------------------------------------------------------------

export type PageReportReason = 'IMAGE_CORRUPTED' | 'MISSING_PAGE' | 'WRONG_ORDER' | 'LOW_QUALITY';

export const PAGE_REPORT_REASON_LABELS: Record<PageReportReason, string> = {
  IMAGE_CORRUPTED: 'Image corrupted or not loading',
  MISSING_PAGE: 'A page is missing',
  WRONG_ORDER: 'Pages are in the wrong order',
  LOW_QUALITY: 'Low quality / unreadable'
};

export interface PageReport {
  id: string;
  chapterId: string;
  workId: string;
  chapterNumber: string;
  pageNumber: number;
  reason: PageReportReason;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string | null;
}

export interface WorkProgress {
  workId: string;
  finishedChapterIds: string[];
  /** The chapter to read next; `null` when the reader is up to date. */
  nextChapterId: string | null;
}

export interface Bookmark {
  workId: string;
  lastReadChapterId?: string | null;
  /** 1-based page number of the last page read (see `UpdateProgressRequest.pageIndex`). */
  lastReadPageIndex: number;
  status: BookmarkStatus;
  updatedAt: string;
}

export interface UpdateProgressRequest {
  chapterId: string;
  /** 1-based page number (the backend validates `@Min(1)`), despite the field name. */
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
