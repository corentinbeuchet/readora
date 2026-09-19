import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyState } from '@app/shared/ui/empty-state/empty-state';

@Component({
  imports: [EmptyState],
  template: `
    <app-empty-state>
      Your library is empty.
      <a emptyAction href="/works">Browse the catalog</a>
    </app-empty-state>
  `
})
class Host {}

describe('EmptyState', () => {
  let fixture: ComponentFixture<Host>;

  it('says what belongs here and offers the action that fills it', () => {
    givenAnEmptyLibrary();

    thenTheMessageIs('Your library is empty.');
    thenTheActionGoesTo('/works');
  });

  it('keeps the screentone out of the way of assistive technology', () => {
    givenAnEmptyLibrary();

    thenTheDecorationIsHidden();
  });

  function givenAnEmptyLibrary(): void {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  }

  function thenTheMessageIs(message: string): void {
    expect(fixture.nativeElement.querySelector('p').textContent.trim()).toBe(message);
  }

  function thenTheActionGoesTo(href: string): void {
    expect(fixture.nativeElement.querySelector('app-empty-state > a').getAttribute('href')).toBe(href);
  }

  function thenTheDecorationIsHidden(): void {
    expect(fixture.nativeElement.querySelector('.tone').getAttribute('aria-hidden')).toBe('true');
  }
});
