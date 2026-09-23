import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BookmarksApi } from '@app/core/api/bookmarks-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { LoadError } from '@app/shared/ui/load-error';
import { BOOKMARK_STATUS_LABELS } from '@app/core/models/library';

@Component({
  selector: 'app-bookmark-list',
  imports: [LoadError, RouterLink, DatePipe],
  templateUrl: './bookmark-list.html',
  styleUrl: './bookmark-list.scss'
})
export class BookmarkList {
  private readonly bookmarksApi = inject(BookmarksApi);
  protected readonly auth = inject(AuthStore);
  protected readonly statusLabels = BOOKMARK_STATUS_LABELS;

  protected readonly bookmarks = this.bookmarksApi.listResource(computed(() => this.auth.can('LIBRARY_USE')));

  protected reload(): void {
    this.bookmarks.reload();
  }
}
