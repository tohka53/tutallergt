import { AuthService } from '../core/services/auth.service';

/** Devuelve el prefijo de ruta según el rol (mecánico vs cliente). */
export function basePath(auth: AuthService): string {
  return auth.isMechanic() ? '/app' : '/portal';
}
