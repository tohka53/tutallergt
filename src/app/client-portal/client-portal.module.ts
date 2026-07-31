import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { ClientPortalRoutingModule } from './client-portal-routing.module';
import { ClientDashboardComponent } from './dashboard/client-dashboard.component';
import { ClientProfileComponent } from './profile/client-profile.component';

@NgModule({
  declarations: [ClientDashboardComponent, ClientProfileComponent],
  imports: [SharedModule, ClientPortalRoutingModule],
})
export class ClientPortalModule {}
