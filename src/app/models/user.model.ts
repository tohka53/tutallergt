/**
 * Roles disponibles en el sistema.
 *
 * El mecánico es un usuario real de Supabase Auth (correo + contraseña).
 * El cliente NO tiene usuario: entra sólo con su número de teléfono y su
 * "sesión" vive únicamente en su navegador. Por eso el cliente sólo puede
 * leer, y siempre a través de las funciones portal_* del servidor.
 */
export type Role = 'mechanic' | 'client';

export interface User {
  id: string;
  email: string;
  phone: string;
  displayName: string;
  role: Role;
  /** Sólo para clientes: enlaza con el registro de Client */
  clientId?: string;
  active: boolean;
  createdAt: string; // ISO
}
