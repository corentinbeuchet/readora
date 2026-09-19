import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AuthStore } from '@app/core/auth/auth-store';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { Permission } from '@app/core/models/identity';
import { givenIAmSignedInWith, mockUser } from './auth-fixtures';
import { provideHttpTesting } from '../../test-utils';

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

/** What each gated element of `HostComponent` is, by its class. */
type Gated = 'publish' | 'any' | 'save' | 'upsell';

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

  it('hides gated content for anonymous users and renders the else template', () => {
    whenTheHostRenders();

    thenIDoNotSee('publish');
    thenIDoNotSee('any');
    thenIDoNotSee('save');
    thenISee('upsell');
  });

  it('hides Publish for a plain reader, shows it for a scanlator, and reacts to store changes', async () => {
    await givenIAmSignedInWith(['COMMENT_WRITE', 'COMMENT_UPVOTE']);

    whenTheHostRenders();

    thenIDoNotSee('publish');

    whenMyPermissionsBecome(['CHAPTER_PUBLISH', 'TASK_SUBMIT']);

    thenISee('publish');
    thenISee('any');

    whenMySessionIsCleared();

    thenIDoNotSee('publish');
  });

  it('swaps else template for the real content once BOOKMARK_WRITE is granted', async () => {
    await givenIAmSignedInWith(['BOOKMARK_WRITE']);

    whenTheHostRenders();

    thenISee('save');
    thenIDoNotSee('upsell');
  });

  function whenTheHostRenders(): void {
    fixture.detectChanges();
  }

  function whenMyPermissionsBecome(permissions: Permission[]): void {
    store.setUser(mockUser({ permissions }));
    fixture.detectChanges();
  }

  function whenMySessionIsCleared(): void {
    store.clearSession();
    fixture.detectChanges();
  }

  function thenISee(element: Gated): void {
    expect(gated(element)).not.toBeNull();
  }

  function thenIDoNotSee(element: Gated): void {
    expect(gated(element)).toBeNull();
  }

  function gated(element: Gated): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`.${element}`);
  }
});
