import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkCardSkeleton } from '@app/shared/ui/work-card-skeleton/work-card-skeleton';

@Component({
  imports: [WorkCardSkeleton],
  template: `<app-work-card-skeleton variant="row" count="4">Loading the ranking…</app-work-card-skeleton>`
})
class Host {}

describe('WorkCardSkeleton', () => {
  let fixture: ComponentFixture<Host>;

  it('tells screen readers what is loading, and hides the placeholders from them', () => {
    givenAListIsLoading();

    thenTheStatusSays('Loading the ranking…');
    thenThePlaceholdersAreHiddenFromAssistiveTechnology();
  });

  it('draws as many placeholders as asked', () => {
    givenAListIsLoading();

    thenThereArePlaceholders(4);
  });

  function givenAListIsLoading(): void {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  }

  function thenTheStatusSays(message: string): void {
    const status: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');
    expect(status.textContent?.trim()).toBe(message);
  }

  function thenThePlaceholdersAreHiddenFromAssistiveTechnology(): void {
    expect(fixture.nativeElement.querySelector('ul').getAttribute('aria-hidden')).toBe('true');
  }

  function thenThereArePlaceholders(count: number): void {
    expect(fixture.nativeElement.querySelectorAll('li')).toHaveLength(count);
  }
});
