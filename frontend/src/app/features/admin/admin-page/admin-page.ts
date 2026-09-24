import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { AdminApi } from '@app/core/api/admin-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { ACCOUNT_SEARCH_MIN, AdminAccount, ROLES, ROLE_LABELS, Role } from '@app/core/models/identity';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';

/** Waits this long after the last key before searching. */
export const ACCOUNT_SEARCH_DEBOUNCE_MS = 300;
/** The length an admin suspends for from this page (the API takes 1 to 365 days). */
export const SUSPENSION_DAYS = 7;

/** Looking after accounts (US-16, admins): find one, change its role, keep it out for a while or for good, let it back. */
@Component({
  selector: 'app-admin-page',
  imports: [LoadError, DatePipe],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.scss'
})
export class AdminPage {
  private readonly adminApi = inject(AdminApi);
  private readonly auth = inject(AuthStore);

  protected readonly roles = ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly searchMin = ACCOUNT_SEARCH_MIN;
  protected readonly suspensionDays = SUSPENSION_DAYS;
  protected readonly typed = signal('');
  protected readonly query = toSignal(
    toObservable(this.typed).pipe(debounceTime(ACCOUNT_SEARCH_DEBOUNCE_MS), map((text) => text.trim()), distinctUntilChanged()),
    { initialValue: '' }
  );
  protected readonly accounts = this.adminApi.accountsResource(this.query);
  protected readonly me = computed(() => this.auth.user()?.id ?? null);
  /** Role change / suspend / ban / reinstate: `busyKey` is the account being changed. */
  protected readonly action = asyncAction();
  protected readonly done = signal('');

  constructor() {
    inject(SeoService).private_($localize`:@@admin.page.seoTitle:Accounts`);
  }

  protected assignRole(account: AdminAccount, role: string): Promise<void> {
    return this.change(account, () => firstValueFrom(this.adminApi.assignRole(account.id, role as Role)),
      $localize`:@@admin.page.roleChanged:${account.username}:username: is now ${ROLE_LABELS[role as Role]}:role:.`);
  }

  protected suspend(account: AdminAccount): Promise<void> {
    return this.change(account, () => firstValueFrom(this.adminApi.suspend(account.id, SUSPENSION_DAYS)),
      $localize`:@@admin.page.suspended:${account.username}:username: is suspended for ${SUSPENSION_DAYS}:days: days.`);
  }

  protected ban(account: AdminAccount): Promise<void> {
    return this.change(account, () => firstValueFrom(this.adminApi.ban(account.id)), $localize`:@@admin.page.banned:${account.username}:username: is banned.`);
  }

  protected reinstate(account: AdminAccount): Promise<void> {
    return this.change(account, () => firstValueFrom(this.adminApi.reinstate(account.id)),
      $localize`:@@admin.page.reinstated:${account.username}:username: can use the account again.`);
  }

  private async change(account: AdminAccount, request: () => Promise<AdminAccount>, outcome: string): Promise<void> {
    this.done.set('');
    await this.action.run(async () => {
      const updated = await request();
      this.accounts.update((list) => list?.map((item) => (item.id === updated.id ? updated : item)));
      this.done.set(outcome);
    }, { key: account.id });
  }
}
