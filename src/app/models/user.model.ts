/**
 * Roles disponibles en el sistema.
 * En producción estos valores deberían venir del backend / claims del JWT.
 */
export type Role = 'mechanic' | 'client';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  /** Sólo para clientes: enlaza con el registro de Client */
  clientId?: string;
  active: boolean;
  createdAt: string; // ISO
}
