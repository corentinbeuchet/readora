export const PERMISSIONS = [
  'COMMENT_WRITE',
  'COMMENT_UPVOTE',
  'USER_MANAGE',
  'LIBRARY_USE',
  'PAGE_REPORT',
  'RATE_WORK',
  'COMMENT_REPORT',
  'COMMENT_MODERATE'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'READER' | 'MODERATOR' | 'ADMIN';

/** Display names for the codes above (the API sends the codes). */
export const ROLE_LABELS: Record<Role, string> = {
  READER: $localize`:@@role.reader:Reader`,
  MODERATOR: $localize`:@@role.moderator:Moderator`,
  ADMIN: $localize`:@@role.admin:Admin`
};

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  roles: Role[];
  permissions: Permission[];
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserProfile;
}

/** Password limits of every form that sets one (same as the API's). */
export const PASSWORD_MIN_LENGTH = 8;
/** BCrypt reads at most 72 bytes; the API rejects longer passwords. */
export const PASSWORD_MAX_LENGTH = 72;

/** `POST /auth/password` (US-15): the other sessions end, this one gets new tokens. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
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
