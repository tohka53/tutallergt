import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Punto único de acceso a Supabase. Ningún servicio crea su propio cliente:
 * si hubiera dos, cada uno guardaría su propia sesión y el mecánico se
 * quedaría a medio autenticar entre pantallas.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly db: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'mundo-garage-auth',
    },
  });

  /**
   * Convierte el error crudo de Supabase en algo que el mecánico pueda leer.
   * Los mensajes vienen en inglés y algunos son crípticos ("JWT expired"),
   * así que se traducen los más comunes.
   */
  mensaje(error: unknown): string {
    const raw = (error as { message?: string } | null)?.message ?? '';
    const code = (error as { code?: string } | null)?.code ?? '';

    if (!raw) { return 'Ocurrió un error inesperado.'; }
    if (/Invalid login credentials/i.test(raw)) { return 'Correo o contraseña incorrectos.'; }
    if (/Email not confirmed/i.test(raw)) { return 'Falta confirmar el correo de esta cuenta.'; }
    if (/JWT expired|invalid claim/i.test(raw)) { return 'La sesión expiró. Vuelve a iniciar sesión.'; }
    if (/Failed to fetch|NetworkError|network/i.test(raw)) {
      return 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.';
    }
    if (code === '23505' || /duplicate key/i.test(raw)) {
      if (/telefono/i.test(raw)) { return 'Ese número de teléfono ya lo tiene otro cliente.'; }
      if (/placa/i.test(raw)) { return 'Ya existe un vehículo con esa placa.'; }
      return 'Ese registro ya existe.';
    }
    if (code === '42P01' || /does not exist/i.test(raw)) {
      return 'Falta crear las tablas en Supabase. Ejecuta supabase/schema.sql en el editor SQL.';
    }
    if (code === '23503') { return 'No se puede borrar: hay registros que dependen de este.'; }
    if (/row-level security/i.test(raw)) { return 'No tienes permiso para esta operación.'; }
    return raw;
  }
}
