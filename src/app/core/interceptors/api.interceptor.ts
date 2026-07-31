import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Interceptor preparado para producción. Hoy no hace nada porque la demo
 * no usa backend. Al conectar la API:
 *  - Adjuntar el token: req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
 *  - Manejar 401/403 (redirigir a login / denegado)
 *  - Anteponer la baseUrl del environment
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // const token = inject(AuthService).token;
  // if (token) req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(req);
};
