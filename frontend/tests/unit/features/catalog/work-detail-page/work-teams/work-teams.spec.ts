import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TeamShare } from '@app/core/models/chapter';
import { WorkTeams } from '@app/features/catalog/work-detail-page/work-teams/work-teams';
import { ANY_URL } from '../../../../test-utils';

describe('WorkTeams (US-12)', () => {
  let fixture: ComponentFixture<WorkTeams>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WorkTeams], providers: [provideRouter(ANY_URL)] }).compileComponents();
  });

  it('lists each team with its number of chapters and a link to its page', async () => {
    await givenTheSeriesIsTranslatedBy([share('t-shadow', 'Shadow Scans', 2), share('t-moon', 'Moon Scans', 1)]);

    thenTheTeamsAre([
      { team: 'Shadow Scans', chapters: '2 chapters', href: '/teams/t-shadow' },
      { team: 'Moon Scans', chapters: '1 chapter', href: '/teams/t-moon' }
    ]);
  });

  it('the section is named by its heading', async () => {
    await givenTheSeriesIsTranslatedBy([share('t-shadow', 'Shadow Scans', 2)]);

    thenTheSectionIsNamed('Translated by');
  });

  async function givenTheSeriesIsTranslatedBy(teams: TeamShare[]): Promise<void> {
    fixture = TestBed.createComponent(WorkTeams);
    fixture.componentRef.setInput('teams', teams);
    await fixture.whenStable();
  }

  function thenTheTeamsAre(expected: { team: string; chapters: string; href: string }[]): void {
    const teams: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.team'));
    expect(
      teams.map((team) => ({
        team: team.querySelector('a')!.textContent!.trim(),
        chapters: team.querySelector('.team-count')!.textContent!.trim(),
        href: team.querySelector('a')!.getAttribute('href')
      }))
    ).toEqual(expected);
  }

  function thenTheSectionIsNamed(name: string): void {
    const section: HTMLElement = fixture.nativeElement.querySelector('section');
    const heading = fixture.nativeElement.querySelector(`#${section.getAttribute('aria-labelledby')}`) as HTMLElement;
    expect(heading.textContent!.trim()).toBe(name);
  }

  function share(id: string, name: string, chapterCount: number): TeamShare {
    return { team: { id, name }, chapterCount };
  }
});
