import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { ClientsRoutingModule } from './clients-routing.module';
import { ClientListComponent } from './list/client-list.component';
import { ClientFormComponent } from './form/client-form.component';
import { ClientDetailComponent } from './detail/client-detail.component';

@NgModule({
  declarations: [ClientListComponent, ClientFormComponent, ClientDetailComponent],
  imports: [SharedModule, ClientsRoutingModule],
})
export class ClientsModule {}
