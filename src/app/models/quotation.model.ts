export type QuotationStatus = 'draft' | 'sent' | 'converted' | 'void';
export type AcceptanceChannel = 'call' | 'whatsapp' | 'email' | 'in-person';

export interface QuotationItem {
  id: string;
  type: 'part' | 'material' | 'labor' | 'other';
  code?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number; // monto de descuento por línea
  note?: string;
  /** subtotal calculado = quantity*unitPrice - discount */
  subtotal: number;
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
  applyTax: boolean;
  taxRate: number; // porcentaje, ej 12
  items: QuotationItem[];
  status: QuotationStatus;

  partsSubtotal: number;
  laborSubtotal: number;
  discountTotal: number;
  taxAmount: number;
  total: number;

  // aceptación informativa (no bloquea la conversión)
  acceptanceChannel?: AcceptanceChannel;
  acceptanceDate?: string;
  acceptanceNote?: string;

  convertedServiceId?: string;
  createdAt: string;
  updatedAt: string;
}
