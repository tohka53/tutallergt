import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { VehiclesRoutingModule } from './vehicles-routing.module';
import { VehicleListComponent } from './list/vehicle-list.component';
import { VehicleFormComponent } from './form/vehicle-form.component';
import { VehicleDetailComponent } from './detail/vehicle-detail.component';
import { VehicleHistoryComponent } from './history/vehicle-history.component';
import { DocumentViewerComponent } from './document-viewer/document-viewer.component';

@NgModule({
  declarations: [
    VehicleListComponent, VehicleFormComponent, VehicleDetailComponent,
    VehicleHistoryComponent, DocumentViewerComponent,
  ],
  imports: [SharedModule, VehiclesRoutingModule],
})
export class VehiclesModule {}
