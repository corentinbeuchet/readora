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
  'RATE_WORK',
  'COMMENT_REPORT',
  'COMMENT_MODERATE'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'READER' | 'SCANLATOR' | 'MODERATOR' | 'ADMIN';

export type SubscriptionPlan = 'FREE' | 'PREMIUM';

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  active: boolean;
  currentPeriodEnd: string | null;
  /** Renewal stopped: access continues until `currentPeriodEnd`, then the plan ends. */
  cancelAtPeriodEnd: boolean;
  planPermissions: Permission[];
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
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

export function hasActivePremium(sub: Subscription | null | undefined): boolean {
  return sub?.active === true && sub.plan === 'PREMIUM';
}

/** A paid plan that still renews: free plans have nothing to cancel, a cancellation is only asked once. */
export function canCancelSubscription(sub: Subscription | null | undefined): boolean {
  return !!sub && sub.plan !== 'FREE' && sub.status !== 'CANCELED' && !sub.cancelAtPeriodEnd;
}
