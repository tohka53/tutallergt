import { QuotationStatus } from '../models/quotation.model';
import { ServiceStatus } from '../models/workshop-service.model';

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  converted: 'Convertida en servicio',
  void: 'Anulada',
};

export const QUOTATION_STATUS_CHIP: Record<QuotationStatus, string> = {
  draft: 'tc-chip--draft',
  sent: 'tc-chip--sent',
  accepted: 'tc-chip--ok',
  converted: 'tc-chip--converted',
  void: 'tc-chip--void',
};

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  'received': 'Recibido',
  'diagnosis': 'En diagnóstico',
  'pending-auth': 'Pendiente de autorización',
  'waiting-part': 'Esperando repuesto',
  'repairing': 'En reparación',
  'testing': 'En prueba',
  'done': 'Terminado',
  'delivered': 'Entregado',
  'cancelled': 'Cancelado',
};

export const SERVICE_STATUS_CHIP: Record<ServiceStatus, string> = {
  'received': 'tc-chip--info',
  'diagnosis': 'tc-chip--info',
  'pending-auth': 'tc-chip--warn',
  'waiting-part': 'tc-chip--warn',
  'repairing': 'tc-chip--warn',
  'testing': 'tc-chip--info',
  'done': 'tc-chip--ok',
  'delivered': 'tc-chip--converted',
  'cancelled': 'tc-chip--void',
};

export const ACTIVE_SERVICE_STATUSES: ServiceStatus[] = [
  'received', 'diagnosis', 'pending-auth', 'waiting-part', 'repairing', 'testing',
];
