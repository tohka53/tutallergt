export type VehicleOrigin = 'agency' | 'imported';

export interface Vehicle {
  id: string;
  ownerId: string; // Client.id
  plate: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  type: string;        // sedán, pickup, SUV, etc.
  engineSize: string;  // cilindraje
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
