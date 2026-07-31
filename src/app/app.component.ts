import { Component, inject } from '@angular/core';
import { SeedDataService } from './core/services/seed-data.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: false,
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {
  constructor() {
    // Carga de datos demo la primera vez y refresco de la sesión guardada.
    const seed = inject(SeedDataService);
    const auth = inject(AuthService);
    seed.seedIfNeeded();
    auth.refreshSession();
  }
}
