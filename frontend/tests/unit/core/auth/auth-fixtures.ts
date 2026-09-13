import { HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { ApiResponse, AuthResponse, UserProfile } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';

/** Establishes a full session (token + user) in the store by replaying a fake login. */
export async function signIn(store: AuthStore, http: HttpTestingController, user: UserProfile = mockUser()): Promise<void> {
  const login = firstValueFrom(store.login({ email: user.email, password: 'Sup3rSecret!' }));
  http.expectOne(`${environment.apiUrl}/auth/login`).flush(mockAuthResponse({ user }));
  await login;
}

export function mockUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'reader@readora.test',
    username: 'reader',
    displayName: 'Reader',
    bio: '',
    avatarUrl: null,
    roles: ['READER'],
    permissions: ['COMMENT_WRITE', 'COMMENT_UPVOTE'],
    subscription: { plan: 'FREE', status: 'CANCELED', active: false, currentPeriodEnd: null, planPermissions: [] },
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

export function mockAuthResponse(overrides: Partial<AuthResponse> = {}): ApiResponse<AuthResponse> {
  return {
    success: true,
    error: null,
    data: { accessToken: 'jwt-1', tokenType: 'Bearer', expiresIn: 900, user: mockUser(), ...overrides }
  };
}
