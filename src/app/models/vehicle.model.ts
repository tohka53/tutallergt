export type VehicleOrigin = 'agency' | 'imported';

export interface Vehicle {
  id: string;
  ownerId: string; // Client.id
  plate: string;
  vin: string;
  /** Honda, Toyota, ... */
  brand: string;
  /** Nombre corto del modelo: CR-V, Corolla. */
  model: string;
  /**
   * "Línea" como se usa en Guatemala: la versión completa que se escribe en la
   * cotización — "CR-V LX 4WD". Si va vacía se usa `model`.
   */
  line: string;
  /** Año. En la cotización guatemalteca esta columna se rotula "MODELO". */
  year: number;
  color: string;
  type: string;        // sedán, pickup, SUV, etc.
  engineSize: string;  // cilindraje (C.C.)
  fuelType: string;
  transmission: string;
  mileage: number;
  origin: VehicleOrigin;
  originCountry?: string;
  engineNumber?: string;
  notes: string;
  createdAt: string; // ISO
  active: boolean;
}

export interface VehicleBrand {
  id: string;
  name: string;
}

export interface VehicleModel {
  id: string;
  brandId: string;
  name: string;
}
