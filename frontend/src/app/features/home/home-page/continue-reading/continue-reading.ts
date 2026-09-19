import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HistoryItem } from '@app/core/models/library';
import { Rail } from '@app/shared/ui/rail/rail';
import { WorkCard } from '@app/shared/ui/work-card/work-card';

/**
 * "Continue reading" (US-14): the series a signed-in reader read last, each with a link straight back to the chapter
 * they were in. A finished chapter has nothing to resume: its series page offers the next one.
 */
@Component({
  selector: 'app-continue-reading',
  imports: [RouterLink, Rail, WorkCard],
  templateUrl: './continue-reading.html',
  styleUrl: './continue-reading.scss'
})
export class ContinueReading {
  readonly history = input.required<HistoryItem[]>();

  /** A rail, not the whole history: that has its own page. */
  protected readonly recent = computed(() => this.history().slice(0, 8));
}
