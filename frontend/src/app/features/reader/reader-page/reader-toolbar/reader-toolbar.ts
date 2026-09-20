import { Component, ElementRef, computed, inject, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Toolbar, ToolbarWidget, ToolbarWidgetGroup } from '@angular/aria/toolbar';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { ChapterVersion } from '@app/core/models/chapter';
import { PreferredTeamStore } from '@app/core/reading/preferred-team-store';
import { AutoScroller } from '@app/features/reader/reader-page/auto-scroller';
import { ReaderState } from '@app/features/reader/reader-page/reader-state';

/** Reader header: series and chapter, page position (announced to screen readers), and the reader controls. */
@Component({
  selector: 'app-reader-toolbar',
  imports: [RouterLink, Toolbar, ToolbarWidget, ToolbarWidgetGroup, HasPermissionDirective],
  templateUrl: './reader-toolbar.html',
  styleUrl: './reader-toolbar.scss'
})
export class ReaderToolbar {
  protected readonly state = inject(ReaderState);
  protected readonly autoScroll = inject(AutoScroller);
  private readonly preferredTeam = inject(PreferredTeamStore);

  /** Other teams' versions of the chapter being read (US-12). */
  protected readonly otherVersions = computed(() => {
    const chapter = this.state.currentChapter();
    return (chapter?.versions ?? []).filter((version) => version.chapterId !== chapter?.id);
  });

  readonly zen = input(false);
  readonly settingsOpen = input(false);
  readonly chaptersOpen = input(false);

  readonly zenToggled = output<boolean>();
  readonly settingsToggled = output();
  readonly chaptersToggled = output();
  readonly reportRequested = output();

  private readonly chaptersButton = viewChild.required<ElementRef<HTMLButtonElement>>('chaptersButton');
  private readonly settingsButton = viewChild.required<ElementRef<HTMLButtonElement>>('settingsButton');

  /** Switching version on purpose makes that team mine for this series: the next chapters open in its versions. */
  protected chooseVersion(version: ChapterVersion): void {
    const workId = this.state.currentChapter()?.workId;
    if (workId) {
      this.preferredTeam.remember(workId, version.team.id);
    }
  }

  /** Gives focus back to the button that opened a panel (Escape closes it). */
  focusToggle(panel: 'chapters' | 'settings'): void {
    (panel === 'chapters' ? this.chaptersButton() : this.settingsButton()).nativeElement.focus();
  }
}
