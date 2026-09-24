import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  PasswordResetRequest,
  RegisterRequest,
  ResetPasswordRequest
} from '@app/core/models/identity';
import { ApiClient } from './api-client';

/** `/api/v1/auth` — every call carries the HttpOnly refresh cookie (`withCredentials`). */
@Service()
export class AuthApi {
  private readonly api = inject(ApiClient);

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/register', request, { withCredentials: true });
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', request, { withCredentials: true });
  }

  refresh(): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/refresh', {}, { withCredentials: true });
  }

  changePassword(request: ChangePasswordRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/password', request, { withCredentials: true });
  }

  /** Erases the account (US-15); the refresh cookie is cleared by the answer. */
  deleteAccount(password: string): Observable<string> {
    return this.api.post<string>('/auth/delete-account', { password }, { withCredentials: true });
  }

  /** Answers the same whether an account uses the email or not (US-15). */
  requestPasswordReset(request: PasswordResetRequest): Observable<string> {
    return this.api.post<string>('/auth/password-reset', request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<string> {
    return this.api.post<string>('/auth/password-reset/confirm', request);
  }

  logout(): Observable<string> {
    return this.api.post<string>('/auth/logout', {}, { withCredentials: true });
  }

}
