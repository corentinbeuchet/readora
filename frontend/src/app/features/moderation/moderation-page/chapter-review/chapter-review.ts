import { TimeAgoPipe } from '@app/shared/ui/time-ago.pipe';
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ModerationApi } from '@app/core/api/moderation-api';
import { WaitingChapter } from '@app/core/models/chapter';
import { asyncAction } from '@app/core/utils/async-action';
import { LoadError } from '@app/shared/ui/load-error';

/** A team's first chapter waits here before readers see it (US-11): the moderator looks through it, then publishes it or sends it back. */
@Component({
  selector: 'app-chapter-review',
  imports: [TimeAgoPipe, LoadError, DatePipe],
  templateUrl: './chapter-review.html',
  styleUrl: './chapter-review.scss'
})
export class ChapterReview {
  private readonly api = inject(ModerationApi);

  protected readonly waiting = this.api.waitingChaptersResource();
  /** Publish / send back: `busyKey` is the chapter being decided. */
  protected readonly action = asyncAction();
  /** What the last decision did, for screen readers and at a glance (the chapter leaves the list). */
  protected readonly done = signal('');

  protected publish(chapter: WaitingChapter): Promise<void> {
    return this.decide(chapter, () => firstValueFrom(this.api.approveChapter(chapter.chapterId)),
      $localize`:@@moderation.chapters.published:${chapter.work.title}:series: chapter ${chapter.chapterNumber}:number: is out.`);
  }

  protected sendBack(chapter: WaitingChapter): Promise<void> {
    return this.decide(chapter, () => firstValueFrom(this.api.sendBackChapter(chapter.chapterId)),
      $localize`:@@moderation.chapters.sentBack:${chapter.work.title}:series: chapter ${chapter.chapterNumber}:number: went back to ${chapter.team.name}:team:.`);
  }

  private async decide(chapter: WaitingChapter, decision: () => Promise<unknown>, outcome: string): Promise<void> {
    this.done.set('');
    const decided = await this.action.run(async () => {
      await decision();
      return true;
    }, { key: chapter.chapterId });
    if (decided) {
      this.done.set(outcome);
    }
    // Decided or already decided by someone else: either way the list is out of date.
    this.waiting.reload();
  }
}
