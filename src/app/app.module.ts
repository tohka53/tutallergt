import { APP_INITIALIZER, LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common';
import localeEsGt from '@angular/common/locales/es-GT';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { AccessDeniedComponent } from './shared/components/access-denied/access-denied.component';
import { NotFoundComponent } from './shared/components/not-found/not-found.component';
import { spanishPaginatorIntl } from './shared/paginator-intl';
import { AuthService } from './core/services/auth.service';
import { DataSyncService } from './core/services/data-sync.service';

registerLocaleData(localeEsGt, 'es-GT');

/**
 * Antes de pintar la primera pantalla se recupera la sesión y se cargan los
 * datos. Sin esta espera, los guards preguntarían "¿hay sesión?" mientras
 * Supabase todavía la está leyendo y mandarían al login a alguien que ya
 * había entrado — el clásico "me saca cada vez que recargo".
 */
export function iniciarSesionGuardada(auth: AuthService, sync: DataSyncService) {
  return async () => {
    await auth.restore();
    if (auth.isAuthenticated) {
      await sync.loadForCurrentUser();
    }
  };
}

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
    {
      provide: APP_INITIALIZER,
      useFactory: iniciarSesionGuardada,
      deps: [AuthService, DataSyncService],
      multi: true,
    },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    // Fechas y números en formato de Guatemala (dd/MM/yyyy).
    { provide: LOCALE_ID, useValue: 'es-GT' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-GT' },
    // Paginador en español.
    { provide: MatPaginatorIntl, useFactory: spanishPaginatorIntl },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
