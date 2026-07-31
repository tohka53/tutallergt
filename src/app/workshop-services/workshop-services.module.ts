import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { WorkshopServicesRoutingModule } from './workshop-services-routing.module';
import { ServiceListComponent } from './list/service-list.component';
import { ServiceFormComponent } from './form/service-form.component';
import { ServiceDetailComponent } from './detail/service-detail.component';
import { StatusChangeDialogComponent } from './dialogs/status-change-dialog.component';

@NgModule({
  declarations: [ServiceListComponent, ServiceFormComponent, ServiceDetailComponent, StatusChangeDialogComponent],
  imports: [SharedModule, WorkshopServicesRoutingModule],
})
export class WorkshopServicesModule {}
