import { HttpResourceRef, httpResource } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ACCOUNT_SEARCH_MIN, AdminAccount, Role } from '@app/core/models/identity';
import { ApiClient, parseEnvelope } from './api-client';

/** `/admin/accounts` (US-16, `USER_MANAGE`): find accounts, change their role, keep them out or let them back. */
@Service()
export class AdminApi {
  private readonly api = inject(ApiClient);

  /** Idle until `query` has enough characters. */
  accountsResource(query: Signal<string>): HttpResourceRef<AdminAccount[] | undefined> {
    return httpResource<AdminAccount[]>(
      () => (query().length >= ACCOUNT_SEARCH_MIN ? { url: this.api.url('/admin/accounts'), params: { q: query() } } : undefined),
      { parse: (raw) => parseEnvelope<AdminAccount[]>(raw) ?? [] }
    );
  }

  assignRole(accountId: string, role: Role): Observable<AdminAccount> {
    return this.api.put<AdminAccount>(`/admin/accounts/${accountId}/role`, { role });
  }

  suspend(accountId: string, days: number): Observable<AdminAccount> {
    return this.api.post<AdminAccount>(`/admin/accounts/${accountId}/suspend`, { days });
  }

  ban(accountId: string): Observable<AdminAccount> {
    return this.api.post<AdminAccount>(`/admin/accounts/${accountId}/ban`);
  }

  reinstate(accountId: string): Observable<AdminAccount> {
    return this.api.post<AdminAccount>(`/admin/accounts/${accountId}/reinstate`);
  }
}
