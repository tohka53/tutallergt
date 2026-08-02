import { Injectable, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

/** Punto de corte para "vista móvil": tablas en tarjetas, formularios en 1 columna. */
export const TC_MOBILE_QUERY = '(max-width: 900px)';
/** Punto de corte para el menú lateral: por debajo se muestra como cajón superpuesto. */
export const TC_COMPACT_NAV_QUERY = '(max-width: 1023.98px)';

/**
 * Punto único de verdad para los tamaños de pantalla.
 * Los mismos valores están replicados en `styles.scss`; si cambia uno, cambiar el otro.
 */
@Injectable({ providedIn: 'root' })
export class ResponsiveService {
  private breakpoints = inject(BreakpointObserver);

  readonly isMobile$: Observable<boolean> = this.observe(TC_MOBILE_QUERY);
  readonly isCompactNav$: Observable<boolean> = this.observe(TC_COMPACT_NAV_QUERY);

  get isMobile(): boolean {
    return this.breakpoints.isMatched(TC_MOBILE_QUERY);
  }

  private observe(query: string): Observable<boolean> {
    return this.breakpoints.observe(query).pipe(
      map((state) => state.matches),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }
}
