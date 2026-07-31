/**
 * Configuración del taller. Editable desde la página de Configuración.
 * En producción esto viviría en la base de datos / variables de entorno.
 */
export interface WorkshopSettings {
  name: string;
  logoDataUrl: string; // base64 data URL (demo)
  email: string;
  phone: string;
  address: string;
  taxId: string;   // NIT del taller
  currencySymbol: string; // Q
  defaultTaxRate: number;  // 12
  maxUploadMb: number;     // 5
  colors: {
    black: string;
    yellow: string;
    white: string;
    blue: string;
  };
}
