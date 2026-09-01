/**
 * Metadatos de la tarjeta de circulación. El archivo vive en el bucket
 * PRIVADO "documentos" de Supabase Storage: es un documento personal, así que
 * sólo el mecánico lo abre y siempre con un enlace firmado temporal.
 */
export interface VehicleDocument {
  id: string;
  vehicleId: string;
  kind: 'circulation-card';
  fileName: string;
  mimeType: string;
  size: number;
  /** Ruta dentro del bucket, p. ej. "<mecanicoId>/<vehiculoId>/<uuid>.pdf" */
  path: string;
  uploadedAt: string; // ISO
}
