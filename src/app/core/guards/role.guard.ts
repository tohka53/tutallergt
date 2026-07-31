import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../../models';

/**
 * Restringe rutas por rol. Uso: data: { roles: ['mechanic'] }.
 * PRODUCCIÓN: el backend DEBE volver a validar el rol en cada endpoint.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowed = (route.data['roles'] as Role[] | undefined) ?? [];
  if (!auth.isAuthenticated) {
    return router.createUrlTree(['/auth/login']);
  }
  if (allowed.length === 0 || (auth.role && allowed.includes(auth.role))) {
    return true;
  }
  return router.createUrlTree(['/denied']);
};
