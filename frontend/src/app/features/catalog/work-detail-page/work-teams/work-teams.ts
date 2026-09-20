import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamShare } from '@app/core/models/chapter';
import { SectionHeader } from '@app/shared/ui/section-header/section-header';

/** "Translated by": the teams that published chapters of the series, with how many, each linking to its page. */
@Component({
  selector: 'app-work-teams',
  imports: [RouterLink, SectionHeader],
  templateUrl: './work-teams.html',
  styleUrl: './work-teams.scss'
})
export class WorkTeams {
  /** The one with the most chapters first. */
  readonly teams = input.required<TeamShare[]>();
}
