import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@app/core/auth/auth.guard';
import { permissionGuard } from '@app/core/auth/permission.guard';

/**
 * Page titles / meta are owned by `SeoService` inside each page component (so prerendered HTML
 * and Open Graph tags stay consistent); routes therefore don't declare `title`.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('@app/features/home/home-page/home-page').then((m) => m.HomePage)
  },
  {
    path: 'works',
    loadComponent: () => import('@app/features/catalog/works-page/works-page').then((m) => m.WorksPage)
  },
  {
    path: 'updates',
    loadComponent: () => import('@app/features/discovery/updates-page/updates-page').then((m) => m.UpdatesPage)
  },
  {
    path: 'rankings',
    loadComponent: () => import('@app/features/discovery/rankings-page/rankings-page').then((m) => m.RankingsPage)
  },
  {
    path: 'lists',
    loadComponent: () => import('@app/features/lists/lists-page/lists-page').then((m) => m.ListsPage)
  },
  {
    path: 'lists/:listId',
    loadComponent: () => import('@app/features/lists/list-page/list-page').then((m) => m.ListPage)
  },
  {
    path: 'u/:username',
    loadComponent: () => import('@app/features/community/public-profile-page/public-profile-page').then((m) => m.PublicProfilePage)
  },
  {
    path: 'teams/:teamId',
    loadComponent: () => import('@app/features/community/team-page/team-page').then((m) => m.TeamPage)
  },
  {
    path: 'works/:workId',
    loadComponent: () => import('@app/features/catalog/work-detail-page/work-detail-page').then((m) => m.WorkDetailPage)
  },
  {
    path: 'upload',
    loadComponent: () => import('@app/features/upload/upload-studio-page/upload-studio-page').then((m) => m.UploadStudioPage),
    canActivate: [permissionGuard],
    data: { permission: 'WORK_CREATE' }
  },
  { path: 'read', redirectTo: 'works', pathMatch: 'full' },
  {
    path: 'read/:chapterId',
    loadComponent: () => import('@app/features/reader/reader-page/reader-page').then((m) => m.ReaderPage)
  },
  {
    path: 'scanlation',
    loadComponent: () => import('@app/features/scanlation/my-teams-page/my-teams-page').then((m) => m.MyTeamsPage),
    canActivate: [permissionGuard],
    data: { permission: 'PROJECT_VIEW' }
  },
  {
    path: 'scanlation/series/:workId',
    loadComponent: () => import('@app/features/scanlation/edit-series-page/edit-series-page').then((m) => m.EditSeriesPage),
    canActivate: [permissionGuard],
    data: { permission: 'WORK_CREATE' }
  },
  {
    path: 'scanlation/:projectId',
    loadComponent: () => import('@app/features/scanlation/scanlation-board-page/scanlation-board-page').then((m) => m.ScanlationBoardPage),
    canActivate: [permissionGuard],
    data: { permission: 'PROJECT_VIEW' }
  },

  {
    path: 'library',
    loadComponent: () => import('@app/features/library/library-page/library-page').then((m) => m.LibraryPage),
    canActivate: [permissionGuard],
    data: { permission: 'LIBRARY_USE' }
  },
  {
    path: 'history',
    loadComponent: () => import('@app/features/library/history-page/history-page').then((m) => m.HistoryPage),
    canActivate: [permissionGuard],
    data: { permission: 'LIBRARY_USE' }
  },

  {
    path: 'moderation',
    loadComponent: () => import('@app/features/moderation/moderation-page/moderation-page').then((m) => m.ModerationPage),
    canActivate: [permissionGuard],
    data: { permission: 'COMMENT_MODERATE' }
  },

  {
    path: 'login',
    loadComponent: () => import('@app/features/auth/login-page/login-page').then((m) => m.LoginPage),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('@app/features/auth/register-page/register-page').then((m) => m.RegisterPage),
    canActivate: [guestGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('@app/features/profile/profile-page/profile-page').then((m) => m.ProfilePage),
    canActivate: [authGuard]
  },
  {
    path: 'forbidden',
    loadComponent: () => import('@app/features/layout/forbidden-page').then((m) => m.ForbiddenPage)
  },
  {
    path: '**',
    loadComponent: () => import('@app/features/layout/not-found-page').then((m) => m.NotFoundPage)
  }
];
