export interface RatingSummary {
  /** One decimal; 0 without ratings. */
  average: number;
  count: number;
}

export interface MyRating {
  id: string;
  workId: string;
  score: number;
  liked: string | null;
  disliked: string | null;
  verdict: string | null;
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
  liked: string | null;
  disliked: string | null;
  verdict: string;
  helpfulVotes: number;
  updatedAt: string;
}
