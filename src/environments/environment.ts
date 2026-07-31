/**
 * Configuración de PRODUCCIÓN.
 * `useMockBackend: true` mantiene la demo funcionando con localStorage/IndexedDB.
 * Al conectar el backend real, cambiar a `false` y definir `apiBaseUrl`.
 */
export const environment = {
  production: true,
  useMockBackend: true,
  apiBaseUrl: '', // p.ej. 'https://api.tallercontrol.gt'
  fileStorage: 'indexeddb' as 'indexeddb' | 'supabase' | 's3' | 'api',
};
