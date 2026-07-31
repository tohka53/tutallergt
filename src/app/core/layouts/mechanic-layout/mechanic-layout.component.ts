import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WorkshopSettingsService } from '../../services/workshop-settings.service';

interface NavItem { label: string; icon: string; link: string; }

@Component({
  selector: 'app-mechanic-layout',
  standalone: false,
  templateUrl: './mechanic-layout.component.html',
  styleUrls: ['./mechanic-layout.component.scss'],
})
export class MechanicLayoutComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  settings = inject(WorkshopSettingsService);

  collapsed = false;
  user = this.auth.currentUser;

  nav: NavItem[] = [
    { label: 'Panel', icon: 'dashboard', link: '/app/dashboard' },
    { label: 'Clientes', icon: 'people', link: '/app/clients' },
    { label: 'Vehículos', icon: 'directions_car', link: '/app/vehicles' },
    { label: 'Cotizaciones', icon: 'request_quote', link: '/app/quotations' },
    { label: 'Servicios', icon: 'build', link: '/app/services' },
    { label: 'Catálogo', icon: 'inventory_2', link: '/app/catalog' },
    { label: 'Configuración', icon: 'settings', link: '/app/settings' },
  ];

  toggle(): void { this.collapsed = !this.collapsed; }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
