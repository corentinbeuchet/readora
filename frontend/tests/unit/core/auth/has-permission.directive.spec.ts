import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { Permission } from '@app/core/models/readora.models';
import { mockAuthResponse, mockUser } from './auth-fixtures';
import { API, provideHttpTesting } from '../../test-utils';

@Component({
  imports: [HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button *appHasPermission="'CHAPTER_PUBLISH'" type="button" class="publish">Publish</button>
    <span *appHasPermission="['TASK_CLAIM', 'TASK_SUBMIT']; mode: 'any'" class="any">Any</span>
    <ng-container *appHasPermission="'BOOKMARK_WRITE'; else upsell"><p class="save">Save progress</p></ng-container>
    <ng-template #upsell><p class="upsell">Go premium</p></ng-template>
  `
})
class HostComponent {}

describe('HasPermissionDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let store: AuthStore;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [...provideHttpTesting()]
    }).compileComponents();
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HostComponent);
  });

  afterEach(() => http.verify());

  async function loginWith(permissions: Permission[]): Promise<void> {
    const login = firstValueFrom(store.login({ email: 'a@b.io', password: 'Sup3rSecret!' }));
    http.expectOne(`${API}/auth/login`).flush(mockAuthResponse({ user: mockUser({ permissions }) }));
    await login;
  }

  const q = (selector: string) => fixture.nativeElement.querySelector(selector);

  it('hides gated content for anonymous users and renders the else template', () => {
    fixture.detectChanges();
    expect(q('.publish')).toBeNull();
    expect(q('.any')).toBeNull();
    expect(q('.save')).toBeNull();
    expect(q('.upsell')).not.toBeNull();
  });

  it('hides Publish for a plain reader, shows it for a scanlator, and reacts to store changes', async () => {
    await loginWith(['COMMENT_WRITE', 'COMMENT_UPVOTE']);
    fixture.detectChanges();
    expect(q('.publish')).toBeNull();

    store.setUser(mockUser({ permissions: ['CHAPTER_PUBLISH', 'TASK_SUBMIT'] }));
    fixture.detectChanges();
    expect(q('.publish')).not.toBeNull();
    expect(q('.any')).not.toBeNull();

    store.clearSession();
    fixture.detectChanges();
    expect(q('.publish')).toBeNull();
  });

  it('swaps else template for the real content once BOOKMARK_WRITE is granted', async () => {
    await loginWith(['BOOKMARK_WRITE']);
    fixture.detectChanges();
    expect(q('.save')).not.toBeNull();
    expect(q('.upsell')).toBeNull();
  });
});
