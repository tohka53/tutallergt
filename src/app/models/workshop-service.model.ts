export type ServiceStatus =
  | 'received'
  | 'diagnosis'
  | 'pending-auth'
  | 'waiting-part'
  | 'repairing'
  | 'testing'
  | 'done'
  | 'delivered'
  | 'cancelled';

export interface WorkshopServiceItem {
  id: string;
  type: 'part' | 'material' | 'labor' | 'other';
  code?: string;
  name: string;
  quantity: number;
  /** Costo para el taller. No se muestra al cliente. */
  unitCost: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  costSubtotal: number;
}

export interface ServiceStatusHistory {
  id: string;
  fromStatus: ServiceStatus | null;
  toStatus: ServiceStatus;
  changedAt: string; // ISO
  userId: string;
  userName: string;
  comment: string;
}

export interface WorkshopService {
  id: string;
  number: string; // ORD-0001
  clientId: string;
  vehicleId: string;
  quotationId?: string;

  entryDate: string; // ISO
  estimatedDelivery?: string;
  actualDelivery?: string;
  entryMileage: number;
  fuelLevel?: string;

  reason: string;
  diagnosis: string;
  requestedWork: string;
  performedWork: string;
  internalNotes: string;
  clientVisibleNotes: string;

  items: WorkshopServiceItem[];
  total: number;
  /** Lo que costaron los repuestos. Sólo para el mecánico. */
  costTotal: number;

  mechanicName: string;
  status: ServiceStatus;
  statusHistory: ServiceStatusHistory[];

  createdAt: string;
  updatedAt: string;
}
