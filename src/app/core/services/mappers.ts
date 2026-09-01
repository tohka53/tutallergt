/**
 * Traducción entre las filas de Supabase (snake_case, en español) y los
 * modelos que usan los componentes (camelCase, en inglés).
 *
 * Todo el mapeo vive aquí a propósito: si mañana cambia una columna, se
 * cambia en un solo archivo y ninguna pantalla se entera.
 */
import {
  Client, PartCatalogItem, Quotation, QuotationItem, ServicePhoto,
  ServiceStatus, Vehicle, WorkshopService, WorkshopServiceItem, WorkshopSettings,
} from '../../models';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v == null ? '' : String(v));
const iso = (v: unknown): string => (v ? new Date(String(v)).toISOString() : new Date().toISOString());

// ===========================================================================
// Clientes
// ===========================================================================

export function toClient(r: Row): Client {
  return {
    id: str(r['id']),
    firstName: str(r['nombre']),
    lastName: str(r['apellido']),
    taxId: str(r['nit']) || 'CF',
    phone: str(r['telefono']),
    whatsapp: str(r['whatsapp']) || str(r['telefono']),
    email: str(r['correo']),
    address: str(r['direccion']),
    notes: str(r['notas']),
    createdAt: iso(r['created_at']),
    active: r['activo'] !== false,
  };
}

export function fromClient(c: Partial<Client>): Row {
  const row: Row = {};
  if (c.firstName !== undefined) { row['nombre'] = c.firstName; }
  if (c.lastName !== undefined) { row['apellido'] = c.lastName; }
  if (c.taxId !== undefined) { row['nit'] = c.taxId || 'CF'; }
  if (c.phone !== undefined) { row['telefono'] = c.phone; }
  if (c.whatsapp !== undefined) { row['whatsapp'] = c.whatsapp; }
  if (c.email !== undefined) { row['correo'] = c.email; }
  if (c.address !== undefined) { row['direccion'] = c.address; }
  if (c.notes !== undefined) { row['notas'] = c.notes; }
  if (c.active !== undefined) { row['activo'] = c.active; }
  return row;
}

// ===========================================================================
// Vehículos
//
// Cuidado con los nombres: en la tabla `modelo` es el nombre del modelo
// (CR-V) y `anio` es el año. En la cotización guatemalteca la columna
// rotulada "MODELO" es el AÑO y la rotulada "LÍNEA" es el modelo largo.
// ===========================================================================

export function toVehicle(r: Row): Vehicle {
  return {
    id: str(r['id']),
    ownerId: str(r['cliente_id']),
    plate: str(r['placa']),
    vin: str(r['vin']),
    brand: str(r['marca']),
    model: str(r['modelo']),
    line: str(r['linea']),
    year: num(r['anio']),
    color: str(r['color']),
    type: str(r['tipo']) || 'Carro',
    engineSize: str(r['cilindrada']),
    fuelType: str(r['combustible']) || 'Gasolina',
    transmission: str(r['transmision']) || 'Automática',
    mileage: num(r['kilometraje']),
    origin: str(r['procedencia']) === 'importado' ? 'imported' : 'agency',
    originCountry: str(r['pais_origen']),
    engineNumber: str(r['motor']),
    notes: str(r['notas']),
    createdAt: iso(r['created_at']),
    active: r['activo'] !== false,
  };
}

export function fromVehicle(v: Partial<Vehicle>, ownerName?: string): Row {
  const row: Row = {};
  if (v.ownerId !== undefined) { row['cliente_id'] = v.ownerId; }
  if (ownerName !== undefined) { row['duenio'] = ownerName; }
  if (v.plate !== undefined) { row['placa'] = v.plate.trim().toUpperCase(); }
  if (v.vin !== undefined) { row['vin'] = v.vin; }
  if (v.brand !== undefined) { row['marca'] = v.brand; }
  if (v.model !== undefined) { row['modelo'] = v.model; }
  if (v.line !== undefined) { row['linea'] = v.line; }
  if (v.year !== undefined) { row['anio'] = v.year; }
  if (v.color !== undefined) { row['color'] = v.color; }
  if (v.type !== undefined) { row['tipo'] = v.type || 'Carro'; }
  if (v.engineSize !== undefined) { row['cilindrada'] = v.engineSize; }
  if (v.fuelType !== undefined) { row['combustible'] = v.fuelType; }
  if (v.transmission !== undefined) { row['transmision'] = v.transmission; }
  if (v.mileage !== undefined) { row['kilometraje'] = v.mileage; }
  if (v.origin !== undefined) { row['procedencia'] = v.origin === 'imported' ? 'importado' : 'agencia'; }
  if (v.originCountry !== undefined) { row['pais_origen'] = v.originCountry; }
  if (v.engineNumber !== undefined) { row['motor'] = v.engineNumber; }
  if (v.notes !== undefined) { row['notas'] = v.notes; }
  if (v.active !== undefined) { row['activo'] = v.active; }
  return row;
}

// ===========================================================================
// Catálogo
// ===========================================================================

export function toPart(r: Row): PartCatalogItem {
  return {
    id: str(r['id']),
    code: str(r['codigo']),
    name: str(r['nombre']),
    description: str(r['descripcion']),
    category: str(r['categoria']) || 'General',
    compatibleBrands: (r['marcas'] as string[]) ?? [],
    compatibleModels: (r['modelos'] as string[]) ?? [],
    suggestedCost: num(r['costo_sugerido']),
    suggestedPrice: num(r['precio_sugerido']),
    type: (str(r['tipo']) || 'part') as PartCatalogItem['type'],
    active: r['activo'] !== false,
  };
}

export function fromPart(p: Partial<PartCatalogItem>): Row {
  const row: Row = {};
  if (p.code !== undefined) { row['codigo'] = p.code; }
  if (p.name !== undefined) { row['nombre'] = p.name; }
  if (p.description !== undefined) { row['descripcion'] = p.description; }
  if (p.category !== undefined) { row['categoria'] = p.category || 'General'; }
  if (p.compatibleBrands !== undefined) { row['marcas'] = p.compatibleBrands; }
  if (p.compatibleModels !== undefined) { row['modelos'] = p.compatibleModels; }
  if (p.suggestedCost !== undefined) { row['costo_sugerido'] = p.suggestedCost; }
  if (p.suggestedPrice !== undefined) { row['precio_sugerido'] = p.suggestedPrice; }
  if (p.type !== undefined) { row['tipo'] = p.type; }
  if (p.active !== undefined) { row['activo'] = p.active; }
  return row;
}

// ===========================================================================
// Cotizaciones
// ===========================================================================

export function toQuotationItem(r: Row): QuotationItem {
  return {
    id: str(r['id']),
    type: (str(r['tipo']) || 'part') as QuotationItem['type'],
    code: str(r['codigo']),
    name: str(r['descripcion']),
    quantity: num(r['cantidad']),
    unitCost: num(r['costo_unitario']),
    unitPrice: num(r['precio_unitario']),
    discount: num(r['descuento']),
    note: str(r['nota']),
    subtotal: num(r['subtotal']),
    costSubtotal: num(r['cantidad']) * num(r['costo_unitario']),
  };
}

export function fromQuotationItem(it: QuotationItem, cotizacionId: string, orden: number): Row {
  return {
    cotizacion_id: cotizacionId,
    orden,
    tipo: it.type,
    codigo: it.code ?? '',
    descripcion: it.name,
    nota: it.note ?? '',
    cantidad: it.quantity,
    // La mano de obra nunca lleva costo base: lo forzamos aquí para que no
    // dependa de que la pantalla se acuerde de ponerlo en cero.
    costo_unitario: it.type === 'labor' ? 0 : it.unitCost,
    precio_unitario: it.unitPrice,
    descuento: it.discount,
    subtotal: it.subtotal,
  };
}

export function toQuotation(r: Row, items: Row[] = []): Quotation {
  return {
    id: str(r['id']),
    number: str(r['numero']),
    clientId: str(r['cliente_id']),
    vehicleId: str(r['vehiculo_id']),
    date: iso(r['fecha']),
    validityDays: num(r['validez_dias']) || 15,
    mileage: num(r['kilometraje']),
    paymentMethod: str(r['metodo_pago']),
    notes: str(r['notas']),
    considerations: str(r['consideraciones']),
    items: items.map(toQuotationItem),
    status: (str(r['estado']) || 'draft') as Quotation['status'],
    partsSubtotal: num(r['subtotal_repuestos']),
    laborSubtotal: num(r['subtotal_mano_obra']),
    discountTotal: num(r['descuento_total']),
    subtotal: num(r['subtotal']),
    advance: num(r['anticipo']),
    total: num(r['total']),
    costTotal: num(r['costo_total']),
    profit: num(r['ganancia']),
    acceptedAt: r['aceptada_en'] ? iso(r['aceptada_en']) : undefined,
    convertedServiceId: r['servicio_id'] ? str(r['servicio_id']) : undefined,
    createdAt: iso(r['created_at']),
    updatedAt: iso(r['updated_at']),
  };
}

/** Cotización tal como la devuelve portal_datos: sin costo ni ganancia. */
export function toPortalQuotation(r: Row): Quotation {
  const items = ((r['items'] as Row[]) ?? []).map((i) => ({
    ...toQuotationItem(i),
    unitCost: 0,
    costSubtotal: 0,
  }));
  return {
    ...toQuotation(r, []),
    items,
    costTotal: 0,
    profit: 0,
  };
}

// ===========================================================================
// Servicios
// ===========================================================================

export function toServiceItem(r: Row): WorkshopServiceItem {
  return {
    id: str(r['id']),
    type: (str(r['tipo']) || 'part') as WorkshopServiceItem['type'],
    code: str(r['codigo']),
    name: str(r['descripcion'] ?? r['name']),
    quantity: num(r['cantidad']),
    unitCost: num(r['costo_unitario']),
    unitPrice: num(r['precio_unitario']),
    discount: num(r['descuento']),
    subtotal: num(r['subtotal']),
    costSubtotal: num(r['cantidad']) * num(r['costo_unitario']),
  };
}

export function fromServiceItem(it: WorkshopServiceItem): Row {
  return {
    id: it.id,
    tipo: it.type,
    codigo: it.code ?? '',
    descripcion: it.name,
    cantidad: it.quantity,
    costo_unitario: it.type === 'labor' ? 0 : it.unitCost,
    precio_unitario: it.unitPrice,
    descuento: it.discount,
    subtotal: it.subtotal,
  };
}

export function toService(r: Row): WorkshopService {
  const items = ((r['trabajos'] as Row[]) ?? []).map(toServiceItem);
  return {
    id: str(r['id']),
    number: str(r['numero']),
    clientId: str(r['cliente_id']),
    vehicleId: str(r['vehiculo_id']),
    quotationId: r['cotizacion_id'] ? str(r['cotizacion_id']) : undefined,
    entryDate: iso(r['fecha_creacion']),
    estimatedDelivery: r['entrega_estimada'] ? iso(r['entrega_estimada']) : undefined,
    actualDelivery: r['entrega_real'] ? iso(r['entrega_real']) : undefined,
    entryMileage: num(r['kilometraje']),
    fuelLevel: str(r['nivel_combustible']),
    reason: str(r['descripcion']),
    diagnosis: str(r['diagnostico']),
    requestedWork: str(r['trabajo_solicitado']),
    performedWork: str(r['trabajo_realizado']),
    internalNotes: str(r['notas_internas']),
    clientVisibleNotes: str(r['notas_cliente']),
    items,
    total: num(r['total']),
    costTotal: num(r['costo_total']),
    mechanicName: str(r['mecanico_nombre']),
    status: (str(r['estado']) || 'received') as ServiceStatus,
    statusHistory: ((r['historial'] as Row[]) ?? []).map((h) => ({
      id: str(h['id']),
      fromStatus: (h['de'] ?? null) as ServiceStatus | null,
      toStatus: str(h['a']) as ServiceStatus,
      changedAt: iso(h['fecha']),
      userId: str(h['usuario_id']),
      userName: str(h['usuario']),
      comment: str(h['comentario']),
    })),
    createdAt: iso(r['fecha_creacion']),
    updatedAt: iso(r['updated_at'] ?? r['fecha_creacion']),
  };
}

export function fromService(s: Partial<WorkshopService>, plate?: string, title?: string): Row {
  const row: Row = {};
  if (s.clientId !== undefined) { row['cliente_id'] = s.clientId; }
  if (s.vehicleId !== undefined) { row['vehiculo_id'] = s.vehicleId; }
  if (s.quotationId !== undefined) { row['cotizacion_id'] = s.quotationId || null; }
  if (s.number !== undefined) { row['numero'] = s.number; }
  if (plate !== undefined) { row['placa'] = plate; }
  if (title !== undefined) { row['nombre'] = title; }
  if (s.entryDate !== undefined) { row['fecha_creacion'] = s.entryDate; }
  if (s.estimatedDelivery !== undefined) { row['entrega_estimada'] = s.estimatedDelivery || null; }
  if (s.actualDelivery !== undefined) { row['entrega_real'] = s.actualDelivery || null; }
  if (s.entryMileage !== undefined) { row['kilometraje'] = s.entryMileage; }
  if (s.fuelLevel !== undefined) { row['nivel_combustible'] = s.fuelLevel; }
  if (s.reason !== undefined) { row['descripcion'] = s.reason; }
  if (s.diagnosis !== undefined) { row['diagnostico'] = s.diagnosis; }
  if (s.requestedWork !== undefined) { row['trabajo_solicitado'] = s.requestedWork; }
  if (s.performedWork !== undefined) { row['trabajo_realizado'] = s.performedWork; }
  if (s.internalNotes !== undefined) { row['notas_internas'] = s.internalNotes; }
  if (s.clientVisibleNotes !== undefined) { row['notas_cliente'] = s.clientVisibleNotes; }
  if (s.items !== undefined) { row['trabajos'] = s.items.map(fromServiceItem); }
  if (s.total !== undefined) { row['total'] = s.total; }
  if (s.costTotal !== undefined) { row['costo_total'] = s.costTotal; }
  if (s.mechanicName !== undefined) { row['mecanico_nombre'] = s.mechanicName; }
  if (s.status !== undefined) { row['estado'] = s.status; }
  if (s.statusHistory !== undefined) {
    row['historial'] = s.statusHistory.map((h) => ({
      id: h.id, de: h.fromStatus, a: h.toStatus, fecha: h.changedAt,
      usuario_id: h.userId, usuario: h.userName, comentario: h.comment,
    }));
  }
  return row;
}

// ===========================================================================
// Fotos y configuración
// ===========================================================================

export function toPhoto(r: Row, publicUrl: (path: string) => string): ServicePhoto {
  const path = str(r['ruta']);
  return {
    id: str(r['id']),
    serviceId: str(r['servicio_id']),
    caption: str(r['nota']),
    fileName: str(r['nombre']),
    size: num(r['tamano']),
    path,
    url: publicUrl(path),
    uploadedAt: iso(r['created_at']),
  };
}

export function toSettings(r: Row, fallback: WorkshopSettings): WorkshopSettings {
  return {
    ...fallback,
    name: str(r['nombre']) || fallback.name,
    slogan: str(r['eslogan']) || fallback.slogan,
    logoDataUrl: str(r['logo_url']),
    email: str(r['correo']),
    phone: str(r['telefono']),
    address: str(r['direccion']),
    taxId: str(r['nit']),
    currencySymbol: str(r['moneda']) || 'Q',
    maxUploadMb: num(r['max_subida_mb']) || 5,
  };
}

export function fromSettings(s: WorkshopSettings): Row {
  return {
    nombre: s.name,
    eslogan: s.slogan,
    logo_url: s.logoDataUrl,
    correo: s.email,
    telefono: s.phone,
    direccion: s.address,
    nit: s.taxId,
    moneda: s.currencySymbol,
    max_subida_mb: s.maxUploadMb,
  };
}
