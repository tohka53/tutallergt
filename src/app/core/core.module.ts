import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../shared/material.module';
import { MechanicLayoutComponent } from './layouts/mechanic-layout/mechanic-layout.component';
import { ClientLayoutComponent } from './layouts/client-layout/client-layout.component';

@NgModule({
  declarations: [MechanicLayoutComponent, ClientLayoutComponent],
  imports: [CommonModule, RouterModule, MaterialModule],
  exports: [MechanicLayoutComponent, ClientLayoutComponent],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parent?: CoreModule) {
    if (parent) {
      throw new Error('CoreModule ya está cargado. Impórtalo sólo en AppModule.');
    }
  }
}
