import { Component, DOCUMENT, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommunityApi } from '@app/core/api/community-api';
import { LibraryApi } from '@app/core/api/library-api';
import { AuthStore } from '@app/core/auth/auth-store';
import { LibraryItem, READING_STATUS_LABELS, ReadingStatus } from '@app/core/models/library';
import { SeoService } from '@app/core/seo/seo.service';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';
import { EmptyState } from '@app/shared/ui/empty-state/empty-state';
import { WorkCard } from '@app/shared/ui/work-card/work-card';
import { WorkCardSkeleton } from '@app/shared/ui/work-card-skeleton/work-card-skeleton';

const STATUSES = Object.keys(READING_STATUS_LABELS) as ReadingStatus[];

/** "My library" (US-05): the series I follow, by reading status, with new-chapter badges (US-07). */
@Component({
  selector: 'app-library-page',
  imports: [WorkCard, WorkCardSkeleton, EmptyState, LoadError, RouterLink],
  templateUrl: './library-page.html',
  styleUrl: './library-page.scss'
})
export class LibraryPage {
  private readonly libraryApi = inject(LibraryApi);
  private readonly communityApi = inject(CommunityApi);
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(AuthStore);
  protected readonly statuses = STATUSES;
  protected readonly labels = READING_STATUS_LABELS;

  /** `?status=` query parameter. */
  readonly status = input<string>();

  protected readonly selected = computed(() => STATUSES.find((s) => s === this.status()));
  private readonly enabled = computed(() => this.auth.can('LIBRARY_USE'));
  protected readonly items = this.libraryApi.listResource(this.selected, this.enabled);
  /** Row actions (status, notifications, remove) and the export: `busyKey` is the series being changed. */
  protected readonly action = asyncAction();

  constructor() {
    inject(SeoService).private_($localize`:@@library.page.seoTitle:My library`);
  }

  protected async changeStatus(item: LibraryItem, event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement).value as ReadingStatus;
    await this.run(item, () => firstValueFrom(this.libraryApi.save(item.work.id, status)));
  }

  protected async toggleNotifications(item: LibraryItem, event: Event): Promise<void> {
    const enabled = (event.target as HTMLInputElement).checked;
    await this.run(item, () => firstValueFrom(this.libraryApi.setNotifications(item.work.id, enabled)));
  }

  protected async remove(item: LibraryItem): Promise<void> {
    await this.run(item, () => firstValueFrom(this.libraryApi.remove(item.work.id)));
  }

  /** Downloads my library as a file (US-12). */
  protected async exportLibrary(format: 'csv' | 'json'): Promise<void> {
    await this.action.run(
      async () => this.saveFile(await firstValueFrom(this.communityApi.exportLibrary(format)), `readora-library.${format}`),
      { key: 'export', fallback: $localize`:@@library.page.exportError:Could not export your library. Please try again.` }
    );
  }

  /** Browser side effect, overridable in tests. */
  protected saveFile(file: Blob, name: string): void {
    const win = this.document.defaultView;
    if (!win?.URL?.createObjectURL) return;
    const url = win.URL.createObjectURL(file);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    win.URL.revokeObjectURL(url);
  }

  protected reload(): void {
    this.items.reload();
  }

  private async run(item: LibraryItem, action: () => Promise<unknown>): Promise<void> {
    await this.action.run(
      async () => {
        await action();
        this.items.reload();
      },
      { key: item.work.id, fallback: $localize`:@@library.page.updateError:Could not update “${item.work.title}:title:”. Please try again.` }
    );
  }
}
