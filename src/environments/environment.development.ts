/** Configuración de DESARROLLO (usada por `ng serve`). */
export const environment = {
  production: false,
  useMockBackend: true,
  apiBaseUrl: 'http://localhost:3000',
  fileStorage: 'indexeddb' as 'indexeddb' | 'supabase' | 's3' | 'api',
};
