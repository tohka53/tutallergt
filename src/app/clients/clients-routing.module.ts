import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientListComponent } from './list/client-list.component';
import { ClientFormComponent } from './form/client-form.component';
import { ClientDetailComponent } from './detail/client-detail.component';

const routes: Routes = [
  { path: '', component: ClientListComponent },
  { path: 'new', component: ClientFormComponent },
  { path: ':id/edit', component: ClientFormComponent },
  { path: ':id', component: ClientDetailComponent },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class ClientsRoutingModule {}
