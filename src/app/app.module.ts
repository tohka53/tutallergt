import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { AccessDeniedComponent } from './shared/components/access-denied/access-denied.component';
import { NotFoundComponent } from './shared/components/not-found/not-found.component';
import { apiInterceptor } from './core/interceptors/api.interceptor';

@NgModule({
  declarations: [AppComponent, AccessDeniedComponent, NotFoundComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    CoreModule,
    SharedModule,
  ],
  providers: [
    // HttpClient listo para cuando se conecte la API REST.
    provideHttpClient(withInterceptors([apiInterceptor])),
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
