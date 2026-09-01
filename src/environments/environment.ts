/**
 * Configuración de PRODUCCIÓN.
 *
 * La llave publicable de Supabase está pensada para viajar en el navegador:
 * no es un secreto. Lo que protege los datos son las políticas RLS y las
 * funciones portal_* del archivo supabase/schema.sql, no esconder la llave.
 */
export const environment = {
  production: true,
  supabaseUrl: 'https://ehwgsjbqoczwggkkxfow.supabase.co',
  supabaseKey: 'sb_publishable_UYy4Tbo_vN_YPhDDxRzAEg_8Syym0dX',
  bucketEvidencias: 'evidencias',
  bucketDocumentos: 'documentos',
};
