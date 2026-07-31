import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VehicleListComponent } from './list/vehicle-list.component';
import { VehicleFormComponent } from './form/vehicle-form.component';
import { VehicleDetailComponent } from './detail/vehicle-detail.component';
import { VehicleHistoryComponent } from './history/vehicle-history.component';

const routes: Routes = [
  { path: '', component: VehicleListComponent },
  { path: 'new', component: VehicleFormComponent },
  { path: ':id/edit', component: VehicleFormComponent },
  { path: ':id/history', component: VehicleHistoryComponent },
  { path: ':id', component: VehicleDetailComponent },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class VehiclesRoutingModule {}
