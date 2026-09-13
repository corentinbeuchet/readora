import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '../models/readora.models';
import { ApiClient } from './api-client';

/** `/api/v1/auth` — every call carries the HttpOnly refresh cookie (`withCredentials`). */
@Injectable({ providedIn: 'root' })
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

  logout(): Observable<string> {
    return this.api.post<string>('/auth/logout', {}, { withCredentials: true });
  }

  me(): Observable<UserProfile> {
    return this.api.get<UserProfile>('/auth/me');
  }
}
