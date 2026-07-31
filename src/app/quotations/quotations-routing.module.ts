import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QuotationListComponent } from './list/quotation-list.component';
import { QuotationFormComponent } from './form/quotation-form.component';
import { QuotationDetailComponent } from './detail/quotation-detail.component';

const routes: Routes = [
  { path: '', component: QuotationListComponent },
  { path: 'new', component: QuotationFormComponent },
  { path: ':id/edit', component: QuotationFormComponent },
  { path: ':id', component: QuotationDetailComponent },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class QuotationsRoutingModule {}
