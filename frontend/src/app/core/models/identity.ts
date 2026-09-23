export const PERMISSIONS = [
  'COMMENT_WRITE',
  'COMMENT_UPVOTE',
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

/** Display names for the codes above (the API sends the codes). */
export const ROLE_LABELS: Record<Role, string> = {
  READER: $localize`:@@role.reader:Reader`,
  SCANLATOR: $localize`:@@role.scanlator:Scanlator`,
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
