import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { CatalogApi } from '@app/core/api/catalog-api';
import { WorkSummary } from '@app/core/models/readora.models';
import { WorkCover } from '@app/shared/ui/work-cover';

export const SUGGEST_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

interface Suggestions {
  state: 'idle' | 'done' | 'error';
  text: string;
  items: WorkSummary[];
}

const IDLE: Suggestions = { state: 'idle', text: '', items: [] };

let nextId = 0;

/**
 * Header search box (US-04 "instant search"): an ARIA 1.2 combobox with a listbox of the top five title/author
 * matches. Arrow keys move through the suggestions, Enter opens one (or the full results page), Escape closes.
 */
@Component({
  selector: 'app-omnisearch',
  imports: [WorkCover],
  templateUrl: './omnisearch.html',
  styleUrl: './omnisearch.scss'
})
export class Omnisearch {
  private readonly catalogApi = inject(CatalogApi);
  private readonly router = inject(Router);

  protected readonly listboxId = `omnisearch-listbox-${nextId++}`;
  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);

  protected readonly suggestions = toSignal(
    toObservable(this.text).pipe(
      map((text) => text.trim()),
      debounceTime(SUGGEST_DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((text) => this.lookup(text))
    ),
    { initialValue: IDLE }
  );

  protected readonly expanded = computed(() => this.open() && this.suggestions().state !== 'idle');
  protected readonly activeOptionId = computed(() =>
    this.expanded() && this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null
  );

  protected optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(-1);
    this.open.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.suggestions().items;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        this.open.set(true);
        if (items.length === 0) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.update((index) => (index + step + items.length) % items.length);
        return;
      }
      case 'Enter': {
        event.preventDefault();
        const active = items[this.activeIndex()];
        if (this.expanded() && active) {
          this.openWork(active);
        } else {
          this.searchAll();
        }
        return;
      }
      case 'Escape':
        if (this.expanded()) {
          event.preventDefault();
          this.close();
        } else {
          this.text.set('');
        }
        return;
    }
  }

  /** Clicking an option must win over the input's blur. */
  protected keepFocus(event: MouseEvent): void {
    event.preventDefault();
  }

  protected openWork(work: WorkSummary): void {
    this.close();
    this.text.set('');
    void this.router.navigate(['/works', work.id]);
  }

  protected searchAll(): void {
    const text = this.text().trim();
    if (!text) return;
    this.close();
    void this.router.navigate(['/works'], { queryParams: { q: text } });
  }

  protected close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  private lookup(text: string): Observable<Suggestions> {
    if (text.length < MIN_QUERY_LENGTH) {
      return of(IDLE);
    }
    return this.catalogApi.suggest(text).pipe(
      map((items): Suggestions => ({ state: 'done', text, items })),
      catchError(() => of<Suggestions>({ state: 'error', text, items: [] }))
    );
  }
}
