/** Limits shared by the login and sign-up forms (same as the API's); password ones are app-wide. */
export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@app/core/models/identity';
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
