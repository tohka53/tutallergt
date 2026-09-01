export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'converted' | 'void';
export type AcceptanceChannel = 'call' | 'whatsapp' | 'email' | 'in-person';

export interface QuotationItem {
  id: string;
  type: 'part' | 'material' | 'labor' | 'other';
  code?: string;
  name: string;
  quantity: number;
  /**
   * Lo que le cuesta el repuesto al taller. La mano de obra siempre va en 0:
   * no tiene costo base, todo lo que se cobra por ella es ganancia.
   * NUNCA se muestra al cliente ni sale en el PDF.
   */
  unitCost: number;
  /** Lo que se le cobra al cliente. Este es el único precio que ve el cliente. */
  unitPrice: number;
  discount: number; // monto de descuento por línea
  note?: string;
  /** subtotal calculado = quantity*unitPrice - discount */
  subtotal: number;
  /** costo calculado = quantity*unitCost */
  costSubtotal: number;
}

export interface Quotation {
  id: string;
  number: string; // COT-0001
  clientId: string;
  vehicleId: string;
  date: string;        // ISO
  validityDays: number;
  mileage: number;
  paymentMethod: string;
  notes: string;
  considerations: string;
  items: QuotationItem[];
  status: QuotationStatus;

  partsSubtotal: number;
  laborSubtotal: number;
  discountTotal: number;
  /** repuestos + mano de obra, ya con descuentos */
  subtotal: number;
  /** pago adelantado del cliente; se resta del total */
  advance: number;
  /** subtotal - anticipo. Es la cifra grande del PDF. */
  total: number;

  // ===== Sólo para el mecánico. El cliente no ve nada de esto. =====
  /** suma de lo que costaron los repuestos */
  costTotal: number;
  /** subtotal - costTotal */
  profit: number;

  acceptedAt?: string;
  convertedServiceId?: string;
  createdAt: string;
  updatedAt: string;
}
