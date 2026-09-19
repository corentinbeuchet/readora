export interface ChapterComment {
  id: string;
  chapterId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  pageReference: number | null;
  parentId: string | null;
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

export type CommentReportReason = 'UNMARKED_SPOILER' | 'HARASSMENT' | 'SPAM';

export const COMMENT_REPORT_REASON_LABELS: Record<CommentReportReason, string> = {
  UNMARKED_SPOILER: $localize`:@@commentReport.reason.unmarkedSpoiler:Unmarked spoiler`,
  HARASSMENT: $localize`:@@commentReport.reason.harassment:Harassment or abuse`,
  SPAM: $localize`:@@commentReport.reason.spam:Spam or scam`
};

export interface ModerationItem {
  reportId: string;
  reason: CommentReportReason;
  reportedAt: string;
  commentId: string;
  chapterId: string;
  authorUsername: string;
  content: string;
  spoiler: boolean;
}

export interface CreateCommentRequest {
  content: string;
  pageReference: number | null;
  parentId: string | null;
  isSpoiler: boolean;
}
