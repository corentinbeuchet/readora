import { Component, booleanAttribute, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadingList } from '@app/core/models/reading-lists';
import { Icon } from '@app/shared/ui/icon/icon';
import { WorkCover } from '@app/shared/ui/work-cover/work-cover';

/**
 * A reading list as a card: a stack of the covers of its first series (so a reader can judge it before opening it),
 * its title as the one stretched link, its curator, size and upvotes.
 */
@Component({
  selector: 'app-list-card',
  imports: [RouterLink, WorkCover, Icon],
  templateUrl: './list-card.html',
  styleUrl: './list-card.scss'
})
export class ListCard {
  readonly list = input.required<ReadingList>();
  /** Public / private badge: for the owner's own lists. */
  readonly showVisibility = input(false, { transform: booleanAttribute });
  /** Off under "My lists": my own name on every card says nothing. */
  readonly showOwner = input(true, { transform: booleanAttribute });

  protected readonly covers = computed(() => this.list().items.slice(0, 3).map((item) => item.work));
}
