import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Vehicle, Client } from '../../models';

/**
 * Reglas de autorización centralizadas. Se usan tanto en la UI (ocultar botones)
 * como una segunda barrera lógica antes de ejecutar acciones sensibles.
 *
 * PRODUCCIÓN: estas mismas reglas DEBEN reimplementarse y validarse en el backend.
 * Ocultar botones en el cliente no es seguridad real.
 */
@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private auth = inject(AuthService);

  isMechanic(): boolean {
    return this.auth.isMechanic();
  }

  /** Sólo el mecánico puede eliminar vehículos. */
  canDeleteVehicle(): boolean {
    return this.auth.isMechanic();
  }

  canManageServices(): boolean {
    return this.auth.isMechanic();
  }

  canEditPricing(): boolean {
    return this.auth.isMechanic();
  }

  /** El cliente sólo puede ver/editar recursos de su propio clientId. */
  canAccessClient(clientId: string): boolean {
    const u = this.auth.currentUser;
    if (!u) { return false; }
    if (u.role === 'mechanic') { return true; }
    return u.clientId === clientId;
  }

  canAccessVehicle(vehicle: Vehicle): boolean {
    return this.canAccessClient(vehicle.ownerId);
  }

  canEditClient(client: Client): boolean {
    const u = this.auth.currentUser;
    if (!u) { return false; }
    if (u.role === 'mechanic') { return true; }
    return u.clientId === client.id;
  }

  /** clientId del usuario actual (para filtrar listados del cliente). */
  currentClientId(): string | null {
    return this.auth.currentUser?.clientId ?? null;
  }
}
