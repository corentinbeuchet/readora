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

export type SubscriptionStatus = 'ACTIVE' | 'CANCELED';

/** Display names for the codes above (the API sends the codes). */
export const ROLE_LABELS: Record<Role, string> = {
  READER: $localize`:@@role.reader:Reader`,
  SCANLATOR: $localize`:@@role.scanlator:Scanlator`,
  MODERATOR: $localize`:@@role.moderator:Moderator`,
  ADMIN: $localize`:@@role.admin:Admin`
};

export const SUBSCRIPTION_PLAN_LABELS: Record<SubscriptionPlan, string> = {
  FREE: $localize`:@@subscriptionPlan.free:Free`,
  PREMIUM: $localize`:@@subscriptionPlan.premium:Premium`
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: $localize`:@@subscriptionStatus.active:Active`,
  CANCELED: $localize`:@@subscriptionStatus.canceled:Cancelled`
};

export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  active: boolean;
  currentPeriodEnd: string | null;
  /** Renewal stopped: access continues until `currentPeriodEnd`, then the plan ends. */
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
  /** Left out = unchanged. */
  displayName?: string;
  bio?: string;
  /** `null` (or empty) removes the avatar. */
  avatarUrl: string | null;
}

export function hasActivePremium(sub: Subscription | null): boolean {
  return sub?.active === true && sub.plan === 'PREMIUM';
}
