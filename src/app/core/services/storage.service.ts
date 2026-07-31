import { Injectable } from '@angular/core';

/**
 * Capa única de acceso a localStorage.
 * Ningún componente debe usar localStorage directamente: siempre via este servicio.
 *
 * PRODUCCIÓN: reemplazar esta implementación por llamadas HTTP a una API REST.
 * La interfaz (get/set/remove) puede mantenerse y sólo cambiar el cuerpo,
 * o inyectar una implementación distinta mediante un token de DI.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly prefix = 'taller-control:';

  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (raw == null) { return fallback; }
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  remove(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  has(key: string): boolean {
    return localStorage.getItem(this.prefix + key) !== null;
  }
}
