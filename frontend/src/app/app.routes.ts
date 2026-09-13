import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/auth/permission.guard';
import { ChapterViewer } from './features/reader/components/chapter-viewer';
import { KanbanBoard } from './features/scanlation/components/kanban-board';

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
    path: 'works/:workId',
    loadComponent: () => import('./features/catalog/work-detail-page').then((m) => m.WorkDetailPage)
  },
  { path: 'read', redirectTo: 'works', pathMatch: 'full' },
  { path: 'read/:chapterId', component: ChapterViewer },
  {
    path: 'scanlation',
    component: KanbanBoard,
    canActivate: [permissionGuard],
    data: { permission: 'PROJECT_VIEW' }
  },
  {
    path: 'scanlation/:projectId',
    component: KanbanBoard,
    canActivate: [permissionGuard],
    data: { permission: 'PROJECT_VIEW' }
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
