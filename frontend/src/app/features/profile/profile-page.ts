import { afterNextRender, Component, computed, inject, model, viewChild } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { AuthStore } from '@app/core/auth/auth-store';
import { UserProfile } from '@app/core/models/readora.models';
import { SeoService } from '@app/core/seo/seo.service';
import { BookmarkList } from './bookmark-list';
import { ProfileForm } from './profile-form';

export type ProfileTab = 'overview' | 'bookmarks' | 'subscription';

@Component({
  selector: 'app-profile-page',
  imports: [NgOptimizedImage, RouterLink, DatePipe, Tabs, TabList, Tab, TabPanel, TabContent, ProfileForm, BookmarkList],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss'
})
export class ProfilePage {
  protected readonly auth = inject(AuthStore);
  protected readonly permissions = computed(() => (this.auth.user()?.permissions ?? []).join(', '));
  private readonly seo = inject(SeoService);
  protected readonly selectedTab = model<ProfileTab>('overview');
  protected readonly tabList = viewChild<TabList>(TabList);

  constructor() {
    this.seo.private_('My profile');
    afterNextRender(() => {
      this.tabList()?.open(this.selectedTab() ?? 'overview');
    });
  }

  protected onSaved(_profile: UserProfile): void {
    // AuthStore is already updated by the form; nothing else to do for now.
  }
}
