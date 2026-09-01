/**
 * Datos del taller que salen en el encabezado de la app y en el PDF.
 * Se guardan en la tabla `taller_config` de Supabase, una fila por mecánico.
 */
export interface WorkshopSettings {
  name: string;
  slogan: string;
  /** data URL o ruta al logo. Vacío = se usa el logo incluido en la app. */
  logoDataUrl: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;   // NIT del taller
  currencySymbol: string; // Q
  maxUploadMb: number;    // 5
  colors: {
    black: string;
    yellow: string;
    white: string;
    blue: string;
  };
}
