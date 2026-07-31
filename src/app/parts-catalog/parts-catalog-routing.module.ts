import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PartsCatalogListComponent } from './list/parts-catalog-list.component';

const routes: Routes = [{ path: '', component: PartsCatalogListComponent }];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class PartsCatalogRoutingModule {}
