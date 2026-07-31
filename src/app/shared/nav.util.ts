import { AuthService } from '../core/services/auth.service';
/** Prefijo de ruta según rol: /app (mecánico) o /portal (cliente). */
export function basePath(auth: AuthService): string {
  return auth.isMechanic() ? '/app' : '/portal';
}
