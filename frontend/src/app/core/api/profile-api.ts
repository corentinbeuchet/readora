import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { UpdateProfileRequest, UserProfile } from '@app/core/models/identity';
import { ApiClient, toApiError } from './api-client';

/** `/api/v1/profile` */
@Service()
export class ProfileApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiClient);

  update(request: UpdateProfileRequest): Observable<UserProfile> {
    return this.api.put<UserProfile>('/profile', request);
  }

  /** Everything Readora keeps about me, as one JSON file (US-15): a file, not an API envelope. */
  exportAccount(): Observable<Blob> {
    return this.http.get(this.api.url('/account/export'), { responseType: 'blob' }).pipe(catchError(toApiError));
  }
}
