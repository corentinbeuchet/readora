import { afterNextRender, Component, computed, inject, model, viewChild } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { AuthStore } from '@app/core/auth/auth-store';
import { ROLE_LABELS, SUBSCRIPTION_PLAN_LABELS, SUBSCRIPTION_STATUS_LABELS, UserProfile } from '@app/core/models/identity';
import { SeoService } from '@app/core/seo/seo.service';
import { BookmarkList } from './bookmark-list/bookmark-list';
import { ProfileForm } from './profile-form/profile-form';

export type ProfileTab = 'overview' | 'bookmarks' | 'subscription';

@Component({
  selector: 'app-profile-page',
  imports: [NgOptimizedImage, RouterLink, DatePipe, Tabs, TabList, Tab, TabPanel, TabContent, ProfileForm, BookmarkList],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss'
})
export class ProfilePage {
  protected readonly auth = inject(AuthStore);
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly planLabels = SUBSCRIPTION_PLAN_LABELS;
  protected readonly subscriptionStatusLabels = SUBSCRIPTION_STATUS_LABELS;
  protected readonly avatarAlt = computed(() => {
    const user = this.auth.user();
    return $localize`:@@profile.page.avatarAlt:${user?.displayName || user?.username}:name: avatar`;
  });
  protected readonly permissions = computed(() => (this.auth.user()?.permissions ?? []).join(', '));
  private readonly seo = inject(SeoService);
  protected readonly selectedTab = model<ProfileTab>('overview');
  protected readonly tabList = viewChild<TabList>(TabList);

  constructor() {
    this.seo.private_($localize`:@@profile.page.seoTitle:My profile`);
    afterNextRender(() => {
      this.tabList()?.open(this.selectedTab() ?? 'overview');
    });
  }

  protected onSaved(_profile: UserProfile): void {
    // AuthStore is already updated by the form; nothing else to do for now.
  }
}
