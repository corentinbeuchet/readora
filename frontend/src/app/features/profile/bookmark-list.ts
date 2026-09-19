import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BookmarksApi } from '@app/core/api/bookmarks-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { LoadError } from '@app/shared/ui/load-error';

@Component({
  selector: 'app-bookmark-list',
  imports: [LoadError, RouterLink, DatePipe],
  templateUrl: './bookmark-list.html',
  styleUrl: './bookmark-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookmarkList {
  private readonly bookmarksApi = inject(BookmarksApi);
  protected readonly auth = inject(AuthStore);

  protected readonly canRead = computed(() => this.auth.can('BOOKMARK_READ'));
  protected readonly bookmarks = this.bookmarksApi.listResource(this.canRead);

  protected reload(): void {
    this.bookmarks.reload();
  }
}
