import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Vehicle, Client } from '../../models';

/**
 * Reglas de autorización de la interfaz: sirven para no mostrar botones que
 * de todos modos fallarían.
 *
 * La seguridad real está en la base de datos: RLS sólo deja al mecánico tocar
 * sus propias filas, y el cliente ni siquiera tiene sesión — lee a través de
 * funciones del servidor que devuelven únicamente lo suyo. Esconder un botón
 * nunca es seguridad; aquí es sólo cortesía con quien usa la app.
 *
 * Regla de fondo: el cliente es de SÓLO LECTURA. No crea, no edita, no borra.
 */
@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private auth = inject(AuthService);

  isMechanic(): boolean {
    return this.auth.isMechanic();
  }

  canDeleteVehicle(): boolean { return this.auth.isMechanic(); }
  canEditVehicle(): boolean { return this.auth.isMechanic(); }
  canManageServices(): boolean { return this.auth.isMechanic(); }
  canEditPricing(): boolean { return this.auth.isMechanic(); }
  /** Los costos y la ganancia son sólo del taller. */
  canSeeCosts(): boolean { return this.auth.isMechanic(); }

  /** El cliente sólo alcanza los recursos de su propio clientId. */
  canAccessClient(clientId: string): boolean {
    const u = this.auth.currentUser;
    if (!u) { return false; }
    if (u.role === 'mechanic') { return true; }
    return u.clientId === clientId;
  }

  canAccessVehicle(vehicle: Vehicle): boolean {
    return this.canAccessClient(vehicle.ownerId);
  }

  /** Editar la ficha del cliente es cosa del taller. */
  canEditClient(client: Client): boolean {
    void client;
    return this.auth.isMechanic();
  }

  /** clientId del usuario actual (para filtrar listados del cliente). */
  currentClientId(): string | null {
    return this.auth.currentUser?.clientId ?? null;
  }
}
