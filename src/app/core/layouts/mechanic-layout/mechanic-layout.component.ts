import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ResponsiveService } from '../../services/responsive.service';
import { WorkshopSettingsService } from '../../services/workshop-settings.service';

interface NavItem { label: string; icon: string; link: string; }

@Component({
  selector: 'app-mechanic-layout',
  standalone: false,
  templateUrl: './mechanic-layout.component.html',
  styleUrls: ['./mechanic-layout.component.scss'],
})
export class MechanicLayoutComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private responsive = inject(ResponsiveService);
  settings = inject(WorkshopSettingsService);

  /** true cuando el menú lateral debe comportarse como cajón superpuesto. */
  compactNav = false;
  /** Estado del cajón (en escritorio siempre abierto). */
  navOpen = true;
  /** Menú lateral reducido a solo iconos (solo escritorio). */
  collapsed = false;

  user = this.auth.currentUser;
  private subs = new Subscription();

  nav: NavItem[] = [
    { label: 'Panel', icon: 'dashboard', link: '/app/dashboard' },
    { label: 'Clientes', icon: 'people', link: '/app/clients' },
    { label: 'Vehículos', icon: 'directions_car', link: '/app/vehicles' },
    { label: 'Cotizaciones', icon: 'request_quote', link: '/app/quotations' },
    { label: 'Servicios', icon: 'build', link: '/app/services' },
    { label: 'Catálogo', icon: 'inventory_2', link: '/app/catalog' },
    { label: 'Configuración', icon: 'settings', link: '/app/settings' },
  ];

  ngOnInit(): void {
    this.subs.add(
      this.responsive.isCompactNav$.subscribe((compact) => {
        this.compactNav = compact;
        // En móvil el cajón arranca cerrado; en escritorio siempre visible.
        this.navOpen = !compact;
        if (compact) { this.collapsed = false; }
      })
    );

    // Al navegar en móvil se cierra el cajón para no tapar el contenido.
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(() => { if (this.compactNav) { this.navOpen = false; } })
    );
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  toggle(): void {
    if (this.compactNav) { this.navOpen = !this.navOpen; }
    else { this.collapsed = !this.collapsed; }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
