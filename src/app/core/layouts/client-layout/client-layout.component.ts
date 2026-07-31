import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WorkshopSettingsService } from '../../services/workshop-settings.service';

interface NavItem { label: string; icon: string; link: string; }

@Component({
  selector: 'app-client-layout',
  standalone: false,
  templateUrl: './client-layout.component.html',
  styleUrls: ['./client-layout.component.scss'],
})
export class ClientLayoutComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  settings = inject(WorkshopSettingsService);

  collapsed = false;
  user = this.auth.currentUser;

  nav: NavItem[] = [
    { label: 'Inicio', icon: 'dashboard', link: '/portal/dashboard' },
    { label: 'Mi perfil', icon: 'person', link: '/portal/profile' },
    { label: 'Mis vehículos', icon: 'directions_car', link: '/portal/vehicles' },
    { label: 'Mis cotizaciones', icon: 'request_quote', link: '/portal/quotations' },
    { label: 'Mis servicios', icon: 'build', link: '/portal/services' },
  ];

  toggle(): void { this.collapsed = !this.collapsed; }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
