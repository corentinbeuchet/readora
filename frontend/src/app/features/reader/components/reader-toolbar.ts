import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Toolbar, ToolbarWidget, ToolbarWidgetGroup } from '@angular/aria/toolbar';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { AutoScroller } from '@app/features/reader/services/auto-scroller';
import { ReaderState } from '@app/features/reader/services/reader-state';

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

  readonly zen = input(false);
  readonly settingsOpen = input(false);
  readonly chaptersOpen = input(false);

  readonly zenToggled = output<boolean>();
  readonly settingsToggled = output();
  readonly chaptersToggled = output();
  readonly reportRequested = output();

  private readonly chaptersButton = viewChild.required<ElementRef<HTMLButtonElement>>('chaptersButton');
  private readonly settingsButton = viewChild.required<ElementRef<HTMLButtonElement>>('settingsButton');

  /** Gives focus back to the button that opened a panel (Escape closes it). */
  focusToggle(panel: 'chapters' | 'settings'): void {
    (panel === 'chapters' ? this.chaptersButton() : this.settingsButton()).nativeElement.focus();
  }
}
