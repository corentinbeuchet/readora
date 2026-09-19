import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SectionHeader } from '@app/shared/ui/section-header/section-header';
import { ANY_URL } from '../../../test-utils';

describe('SectionHeader', () => {
  let fixture: ComponentFixture<SectionHeader>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(ANY_URL)] });
  });

  it('is a second-level heading, with an id when a section is labelled by it', () => {
    givenTheHeader({ heading: 'Latest updates', headingId: 'latest' });

    thenTheHeadingIs({ level: 'H2', text: 'Latest updates', id: 'latest' });
    thenThereIsNoLink();
  });

  it('links to the full page with its filters, and names the section in the link', () => {
    givenTheHeader({ heading: 'Action', seeAll: '/works', seeAllParams: { genre: 'Action' } });

    thenTheLinkIs({ href: '/works?genre=Action', name: 'See all: Action' });
  });

  function givenTheHeader(inputs: { heading: string; headingId?: string; seeAll?: string; seeAllParams?: Record<string, string> }): void {
    fixture = TestBed.createComponent(SectionHeader);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  function thenTheHeadingIs(expected: { level: string; text: string; id: string }): void {
    const heading: HTMLElement = fixture.nativeElement.querySelector('h2');
    expect({ level: heading.tagName, text: heading.textContent?.trim(), id: heading.id }).toEqual(expected);
  }

  function thenThereIsNoLink(): void {
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  }

  function thenTheLinkIs(expected: { href: string; name: string }): void {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect({ href: link.getAttribute('href'), name: link.textContent?.replace(/\s+/g, ' ').trim() }).toEqual(expected);
  }
});
