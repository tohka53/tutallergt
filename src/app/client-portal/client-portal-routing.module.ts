import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientDashboardComponent } from './dashboard/client-dashboard.component';
import { ClientProfileComponent } from './profile/client-profile.component';

const routes: Routes = [
  { path: 'dashboard', component: ClientDashboardComponent },
  { path: 'profile', component: ClientProfileComponent },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class ClientPortalRoutingModule {}
