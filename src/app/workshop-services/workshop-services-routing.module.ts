import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ServiceListComponent } from './list/service-list.component';
import { ServiceFormComponent } from './form/service-form.component';
import { ServiceDetailComponent } from './detail/service-detail.component';

const routes: Routes = [
  { path: '', component: ServiceListComponent },
  { path: 'new', component: ServiceFormComponent },
  { path: ':id/edit', component: ServiceFormComponent },
  { path: ':id', component: ServiceDetailComponent },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class WorkshopServicesRoutingModule {}
