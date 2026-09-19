import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/auth/permission.guard';

/**
 * Page titles / meta are owned by `SeoService` inside each page component (so prerendered HTML
 * and Open Graph tags stay consistent); routes therefore don't declare `title`.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/catalog/works-page').then((m) => m.WorksPage)
  },
  {
    path: 'works',
    loadComponent: () => import('./features/catalog/works-page').then((m) => m.WorksPage)
  },
  {
    path: 'updates',
    loadComponent: () => import('./features/discovery/updates-page').then((m) => m.UpdatesPage)
  },
  {
    path: 'rankings',
    loadComponent: () => import('./features/discovery/rankings-page').then((m) => m.RankingsPage)
  },
  {
    path: 'works/:workId',
    loadComponent: () => import('./features/catalog/work-detail-page').then((m) => m.WorkDetailPage)
  },
  {
    path: 'upload',
    loadComponent: () => import('./features/upload/upload-studio-page').then((m) => m.UploadStudioPage),
    canActivate: [permissionGuard],
    data: { permission: 'WORK_CREATE' }
  },
  { path: 'read', redirectTo: 'works', pathMatch: 'full' },
  {
    path: 'read/:chapterId',
    loadComponent: () => import('./features/reader/components/chapter-viewer').then((m) => m.ChapterViewer)
  },
  {
    path: 'scanlation',
    loadComponent: () => import('./features/scanlation/components/kanban-board').then((m) => m.KanbanBoard),
    canActivate: [permissionGuard],
    data: { permission: 'PROJECT_VIEW' }
  },
  {
    path: 'scanlation/:projectId',
    loadComponent: () => import('./features/scanlation/components/kanban-board').then((m) => m.KanbanBoard),
    canActivate: [permissionGuard],
    data: { permission: 'PROJECT_VIEW' }
  },

  {
    path: 'library',
    loadComponent: () => import('./features/library/library-page').then((m) => m.LibraryPage),
    canActivate: [permissionGuard],
    data: { permission: 'LIBRARY_USE' }
  },
  {
    path: 'history',
    loadComponent: () => import('./features/library/history-page').then((m) => m.HistoryPage),
    canActivate: [permissionGuard],
    data: { permission: 'LIBRARY_USE' }
  },

  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register-page').then((m) => m.RegisterPage),
    canActivate: [guestGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
    canActivate: [authGuard]
  },
  {
    path: 'subscription',
    loadComponent: () => import('./features/subscription/plans-page').then((m) => m.PlansPage)
  },
  {
    path: 'subscription/success',
    loadComponent: () => import('./features/subscription/checkout-result-page').then((m) => m.CheckoutResultPage),
    canActivate: [authGuard],
    data: { outcome: 'success' }
  },
  {
    path: 'subscription/cancel',
    loadComponent: () => import('./features/subscription/checkout-result-page').then((m) => m.CheckoutResultPage),
    data: { outcome: 'cancel' }
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./features/layout/forbidden-page').then((m) => m.ForbiddenPage)
  },
  {
    path: '**',
    loadComponent: () => import('./features/layout/not-found-page').then((m) => m.NotFoundPage)
  }
];
