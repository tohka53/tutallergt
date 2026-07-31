import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { QuotationsRoutingModule } from './quotations-routing.module';
import { QuotationListComponent } from './list/quotation-list.component';
import { QuotationFormComponent } from './form/quotation-form.component';
import { QuotationDetailComponent } from './detail/quotation-detail.component';
import { PdfPreviewDialogComponent } from './dialogs/pdf-preview-dialog.component';
import { DeliveryDialogComponent } from './dialogs/delivery-dialog.component';
import { ConvertToServiceDialogComponent } from './dialogs/convert-to-service-dialog.component';

@NgModule({
  declarations: [
    QuotationListComponent, QuotationFormComponent, QuotationDetailComponent,
    PdfPreviewDialogComponent, DeliveryDialogComponent, ConvertToServiceDialogComponent,
  ],
  imports: [SharedModule, QuotationsRoutingModule],
})
export class QuotationsModule {}
