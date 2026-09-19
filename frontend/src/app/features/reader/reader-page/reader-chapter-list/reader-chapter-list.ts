import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { ReadingApi } from '@app/core/api/reading-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { LoadError } from '@app/shared/ui/load-error';

/**
 * Chapter list inside the reader (US-07): every chapter of the series with the ones read marked. Its data loads the
 * first time the list is opened for a series, and stays while the reader is open.
 */
@Component({
  selector: 'app-reader-chapter-list',
  imports: [LoadError, RouterLink],
  templateUrl: './reader-chapter-list.html',
  styleUrl: './reader-chapter-list.scss'
})
export class ReaderChapterList {
  private readonly auth = inject(AuthStore);

  readonly open = input(false);
  readonly workId = input<string>();
  readonly currentChapterId = input<string>();
  /** A chapter link was chosen: the router opens it in the reader. */
  readonly chosen = output();

  /** The series listed: set when the list is first opened, kept afterwards (no refetch on close). */
  private readonly listedWorkId = linkedSignal<{ open: boolean; workId: string | undefined }, string | undefined>({
    source: () => ({ open: this.open(), workId: this.workId() }),
    computation: (now, previous) => (now.open ? now.workId : previous?.value)
  });
  protected readonly chapters = inject(CatalogApi).chaptersResource(this.listedWorkId);
  private readonly progress = inject(ReadingApi).progressResource(
    this.listedWorkId,
    computed(() => this.auth.can('LIBRARY_USE'))
  );
  /** One row per chapter, computed once (not per template call). */
  protected readonly rows = computed(() => {
    const finished = new Set(this.progress.hasValue() ? (this.progress.value()?.finishedChapterIds ?? []) : []);
    const current = this.currentChapterId();
    return (this.chapters.hasValue() ? this.chapters.value() : []).map((chapter) => ({
      chapter,
      current: chapter.id === current,
      read: finished.has(chapter.id)
    }));
  });
}
