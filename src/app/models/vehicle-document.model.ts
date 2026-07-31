/**
 * Metadatos de la tarjeta de circulación. El binario NO se guarda aquí:
 * se guarda en IndexedDB (ver IndexedDbService) referenciado por blobKey.
 */
export interface VehicleDocument {
  id: string;
  vehicleId: string;
  kind: 'circulation-card';
  fileName: string;
  mimeType: string;
  size: number;
  blobKey: string;   // clave en IndexedDB
  uploadedAt: string; // ISO
}
