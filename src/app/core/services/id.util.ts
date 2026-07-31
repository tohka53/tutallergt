/**
 * Generador de IDs tipo UUID v4 (mock, sin dependencias).
 * Usa crypto.randomUUID cuando está disponible; si no, hace fallback.
 * En producción los IDs normalmente los genera el backend.
 */
export function uuid(): string {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
