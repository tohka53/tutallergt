export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  /** NIT o "CF" (consumidor final) */
  taxId: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string; // ISO
  active: boolean;
  /** Usuario de acceso relacionado (User.id) */
  userId?: string;
}
