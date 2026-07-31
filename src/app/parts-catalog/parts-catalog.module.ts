import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { PartsCatalogRoutingModule } from './parts-catalog-routing.module';
import { PartsCatalogListComponent } from './list/parts-catalog-list.component';
import { PartFormDialogComponent } from './form/part-form-dialog.component';

@NgModule({
  declarations: [PartsCatalogListComponent, PartFormDialogComponent],
  imports: [SharedModule, PartsCatalogRoutingModule],
})
export class PartsCatalogModule {}
