import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Rail } from '@app/shared/ui/rail/rail';
import { ANY_URL } from '../../../test-utils';

@Component({
  imports: [Rail],
  template: `
    <app-rail heading="Top rated" seeAll="/rankings">
      <li class="rail-item"><a href="/works/1">One</a></li>
      <li class="rail-item"><a href="/works/2">Two</a></li>
    </app-rail>
  `
})
class Host {}

describe('Rail', () => {
  let fixture: ComponentFixture<Host>;
  let scrolledBy: number[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(ANY_URL)] });
    scrolledBy = [];
  });

  it('is a section named by its heading, holding a list of links (no carousel roles)', () => {
    givenARailOfTwoSeries();

    thenTheSectionIsNamed('Top rated');
    thenTheListHoldsTheLinks(['One', 'Two']);
    thenThereAreNoCarouselRoles();
  });

  it('links to the full page, and the link says which section it belongs to', () => {
    givenARailOfTwoSeries();

    thenTheSeeAllLinkIs({ href: '/rankings', name: 'See all: Top rated' });
  });

  it('pages forward and back with the arrow buttons', () => {
    givenARailOfTwoSeries({ visibleWidth: 400 });

    whenIPress('Scroll forward: Top rated');

    thenTheListScrolledBy(340);

    whenIPress('Scroll back: Top rated');

    thenTheListScrolledBy(-340);
  });

  function givenARailOfTwoSeries(layout: { visibleWidth: number } = { visibleWidth: 400 }): void {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const track = list();
    // jsdom has no layout: give the list a width, room to scroll, and record what it is asked to scroll by.
    Object.defineProperty(track, 'clientWidth', { value: layout.visibleWidth });
    Object.defineProperty(track, 'scrollWidth', { value: layout.visibleWidth * 3 });
    track.scrollBy = ((options: ScrollToOptions) => scrolledBy.push(options.left ?? 0)) as typeof track.scrollBy;
    track.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
  }

  function whenIPress(label: string): void {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(`button[aria-label="${label}"]`);
    button.disabled = false;
    button.click();
    fixture.detectChanges();
  }

  function thenTheSectionIsNamed(heading: string): void {
    const section: HTMLElement = fixture.nativeElement.querySelector('section');
    const labelledBy = section.getAttribute('aria-labelledby')!;
    expect(section.querySelector(`#${labelledBy}`)?.textContent?.trim()).toBe(heading);
  }

  function thenTheListHoldsTheLinks(names: string[]): void {
    expect(Array.from(list().querySelectorAll('a')).map((a) => a.textContent?.trim())).toEqual(names);
  }

  function thenThereAreNoCarouselRoles(): void {
    expect(fixture.nativeElement.querySelector('[aria-roledescription], [role="group"], [role="region"]')).toBeNull();
  }

  function thenTheSeeAllLinkIs(expected: { href: string; name: string }): void {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('app-section-header a');
    expect({ href: link.getAttribute('href'), name: link.textContent?.replace(/\s+/g, ' ').trim() }).toEqual(expected);
  }

  function thenTheListScrolledBy(left: number): void {
    expect(scrolledBy.at(-1)).toBe(left);
  }

  function list(): HTMLElement {
    return fixture.nativeElement.querySelector('ul');
  }
});
