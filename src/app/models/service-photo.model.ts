/**
 * Foto de evidencia de un servicio: cómo se encontró la pieza antes de
 * cambiarla. El binario NO se guarda aquí: vive en IndexedDB (ver
 * IndexedDbService) referenciado por blobKey, igual que la tarjeta de
 * circulación.
 *
 * El cliente ve estas fotos en el detalle de su servicio.
 */
export interface ServicePhoto {
  id: string;
  serviceId: string;
  /** Nota corta del mecánico: "balatas al límite", "rotor rayado", etc. */
  caption: string;
  fileName: string;
  mimeType: string;
  size: number;
  blobKey: string; // clave en IndexedDB
  uploadedAt: string; // ISO
  uploadedById: string;
  uploadedByName: string;
}

/** Máximo de fotos de evidencia por orden de servicio. */
export const MAX_SERVICE_PHOTOS = 3;
