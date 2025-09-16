import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'main',
    loadComponent: () => import('./pages/main/main').then(m => m.Main)
  },
  {
    path: 'anomaly-details',
    loadComponent: () => import('./pages/anomaly-details/anomaly-details').then(m => m.AnomalyDetails)
  },
  {
    path: '**',
    redirectTo: '/main',
    pathMatch: 'full'
  }
]