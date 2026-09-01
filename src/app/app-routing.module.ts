import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MechanicLayoutComponent } from './core/layouts/mechanic-layout/mechanic-layout.component';
import { ClientLayoutComponent } from './core/layouts/client-layout/client-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AccessDeniedComponent } from './shared/components/access-denied/access-denied.component';
import { NotFoundComponent } from './shared/components/not-found/not-found.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then((m) => m.AuthModule),
  },
  // ===== Zona del mecánico =====
  {
    path: 'app',
    component: MechanicLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['mechanic'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadChildren: () => import('./dashboard/dashboard.module').then((m) => m.DashboardModule) },
      { path: 'metrics', loadChildren: () => import('./metrics/metrics.module').then((m) => m.MetricsModule) },
      { path: 'clients', loadChildren: () => import('./clients/clients.module').then((m) => m.ClientsModule) },
      { path: 'vehicles', loadChildren: () => import('./vehicles/vehicles.module').then((m) => m.VehiclesModule) },
      { path: 'quotations', loadChildren: () => import('./quotations/quotations.module').then((m) => m.QuotationsModule) },
      { path: 'services', loadChildren: () => import('./workshop-services/workshop-services.module').then((m) => m.WorkshopServicesModule) },
      { path: 'catalog', loadChildren: () => import('./parts-catalog/parts-catalog.module').then((m) => m.PartsCatalogModule) },
      { path: 'settings', loadChildren: () => import('./settings/settings.module').then((m) => m.SettingsModule) },
    ],
  },
  // ===== Portal del cliente =====
  {
    path: 'portal',
    component: ClientLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['client'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'vehicles', loadChildren: () => import('./vehicles/vehicles.module').then((m) => m.VehiclesModule) },
      { path: 'quotations', loadChildren: () => import('./quotations/quotations.module').then((m) => m.QuotationsModule) },
      { path: 'services', loadChildren: () => import('./workshop-services/workshop-services.module').then((m) => m.WorkshopServicesModule) },
      // dashboard + profile viven en el mismo módulo del portal (montado en path vacío)
      { path: '', loadChildren: () => import('./client-portal/client-portal.module').then((m) => m.ClientPortalModule) },
    ],
  },
  { path: 'denied', component: AccessDeniedComponent },
  { path: '**', component: NotFoundComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
