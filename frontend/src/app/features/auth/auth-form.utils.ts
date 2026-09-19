/** Limits shared by the login and sign-up forms (same as the API's). */
export const PASSWORD_MIN_LENGTH = 8;
/** BCrypt reads at most 72 bytes; the API rejects longer passwords. */
export const PASSWORD_MAX_LENGTH = 72;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
