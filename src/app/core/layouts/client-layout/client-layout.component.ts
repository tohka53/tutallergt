import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ResponsiveService } from '../../services/responsive.service';
import { WorkshopSettingsService } from '../../services/workshop-settings.service';

interface NavItem { label: string; icon: string; link: string; }

@Component({
  selector: 'app-client-layout',
  standalone: false,
  templateUrl: './client-layout.component.html',
  styleUrls: ['./client-layout.component.scss'],
})
export class ClientLayoutComponent implements OnInit, OnDestroy {
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
    { label: 'Inicio', icon: 'dashboard', link: '/portal/dashboard' },
    { label: 'Mi perfil', icon: 'person', link: '/portal/profile' },
    { label: 'Mis vehículos', icon: 'directions_car', link: '/portal/vehicles' },
    { label: 'Mis cotizaciones', icon: 'request_quote', link: '/portal/quotations' },
    { label: 'Mis servicios', icon: 'build', link: '/portal/services' },
  ];

  ngOnInit(): void {
    this.subs.add(
      this.responsive.isCompactNav$.subscribe((compact) => {
        this.compactNav = compact;
        this.navOpen = !compact;
        if (compact) { this.collapsed = false; }
      })
    );

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
