import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { UpdateProfileRequest, UserProfile } from '../models/readora.models';
import { ApiClient } from './api-client';

/** `/api/v1/profile` */
@Service()
export class ProfileApi {
  private readonly api = inject(ApiClient);

  update(request: UpdateProfileRequest): Observable<UserProfile> {
    return this.api.put<UserProfile>('/profile', request);
  }
}
