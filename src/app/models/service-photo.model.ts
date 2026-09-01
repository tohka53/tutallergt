/**
 * Foto de evidencia de un servicio: cómo se encontró la pieza antes de
 * cambiarla. El archivo vive en el bucket público "evidencias" de Supabase
 * Storage; aquí sólo se guarda la ruta y la nota del mecánico.
 *
 * El cliente ve estas fotos en el detalle de su servicio, por eso el bucket
 * es público: el cliente no tiene sesión y no podría firmar una URL.
 */
export interface ServicePhoto {
  id: string;
  serviceId: string;
  /** Nota corta del mecánico: "balatas al límite", "rotor rayado", etc. */
  caption: string;
  fileName: string;
  size: number;
  /** Ruta dentro del bucket, p. ej. "<mecanicoId>/<servicioId>/<uuid>.jpg" */
  path: string;
  /** URL pública lista para usar en un <img>. */
  url: string;
  uploadedAt: string; // ISO
}

/** Máximo de fotos de evidencia por orden de servicio. */
export const MAX_SERVICE_PHOTOS = 3;
