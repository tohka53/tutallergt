/**
 * Listas fijas que no cambian por taller: marcas, modelos y categorías.
 *
 * El catálogo de repuestos ya NO vive aquí: cada mecánico tiene el suyo en
 * Supabase (tabla catalogo_items) y la primera vez se copia con la función
 * sembrar_catalogo() del esquema. Así puede editar precios y costos sin
 * tocar el código.
 */
import { VehicleBrand, VehicleModel } from '../../models';

export const OTHER_BRAND_ID = 'other';

export const VEHICLE_BRANDS: VehicleBrand[] = [
  { id: 'toyota', name: 'Toyota' },
  { id: 'honda', name: 'Honda' },
  { id: 'nissan', name: 'Nissan' },
  { id: 'mazda', name: 'Mazda' },
  { id: 'hyundai', name: 'Hyundai' },
  { id: 'kia', name: 'Kia' },
  { id: 'mitsubishi', name: 'Mitsubishi' },
  { id: 'ford', name: 'Ford' },
  { id: 'chevrolet', name: 'Chevrolet' },
  { id: 'volkswagen', name: 'Volkswagen' },
  { id: OTHER_BRAND_ID, name: 'Otra marca' },
];

export const VEHICLE_MODELS: VehicleModel[] = [
  { id: 'toyota-corolla', brandId: 'toyota', name: 'Corolla' },
  { id: 'toyota-hilux', brandId: 'toyota', name: 'Hilux' },
  { id: 'toyota-rav4', brandId: 'toyota', name: 'RAV4' },
  { id: 'toyota-yaris', brandId: 'toyota', name: 'Yaris' },
  { id: 'honda-crv', brandId: 'honda', name: 'CR-V' },
  { id: 'honda-civic', brandId: 'honda', name: 'Civic' },
  { id: 'honda-accord', brandId: 'honda', name: 'Accord' },
  { id: 'honda-fit', brandId: 'honda', name: 'Fit' },
  { id: 'nissan-sentra', brandId: 'nissan', name: 'Sentra' },
  { id: 'nissan-frontier', brandId: 'nissan', name: 'Frontier' },
  { id: 'nissan-versa', brandId: 'nissan', name: 'Versa' },
  { id: 'mazda-3', brandId: 'mazda', name: 'Mazda 3' },
  { id: 'mazda-cx5', brandId: 'mazda', name: 'CX-5' },
  { id: 'hyundai-tucson', brandId: 'hyundai', name: 'Tucson' },
  { id: 'hyundai-accent', brandId: 'hyundai', name: 'Accent' },
  { id: 'kia-sportage', brandId: 'kia', name: 'Sportage' },
  { id: 'kia-rio', brandId: 'kia', name: 'Rio' },
  { id: 'mitsubishi-lancer', brandId: 'mitsubishi', name: 'Lancer' },
  { id: 'mitsubishi-montero', brandId: 'mitsubishi', name: 'Montero Sport' },
  { id: 'ford-ranger', brandId: 'ford', name: 'Ranger' },
  { id: 'ford-escape', brandId: 'ford', name: 'Escape' },
  { id: 'chevrolet-spark', brandId: 'chevrolet', name: 'Spark' },
  { id: 'chevrolet-dmax', brandId: 'chevrolet', name: 'D-Max' },
  { id: 'volkswagen-jetta', brandId: 'volkswagen', name: 'Jetta' },
];

export const PART_CATEGORIES = [
  'Motor', 'Frenos', 'Suspensión', 'Dirección', 'Transmisión', 'Sistema eléctrico',
  'Enfriamiento', 'Aire acondicionado', 'Filtros', 'Lubricantes', 'Carrocería',
  'Llantas', 'Mano de obra', 'Otros',
];
