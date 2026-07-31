import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { User } from '../../models';

const users: User[] = [
  { id: 'user-mechanic', email: 'mecanico@demo.com', displayName: 'Carlos', role: 'mechanic', active: true, createdAt: '2024-01-01' },
  { id: 'user-client-1', email: 'cliente@demo.com', displayName: 'Ana', role: 'client', clientId: 'client-1', active: true, createdAt: '2024-01-01' },
];

describe('AuthService (login mock y roles)', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('taller-control:users', JSON.stringify(users));
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('inicia sesión con credenciales correctas del mecánico', (done) => {
    service.login('mecanico@demo.com', 'Demo123!').subscribe((u) => {
      expect(u.role).toBe('mechanic');
      expect(service.isAuthenticated).toBeTrue();
      expect(service.isMechanic()).toBeTrue();
      done();
    });
  });

  it('rechaza credenciales incorrectas', (done) => {
    service.login('mecanico@demo.com', 'malo').subscribe({
      next: () => done.fail('no debía iniciar sesión'),
      error: (e: Error) => { expect(e.message).toContain('incorrectas'); done(); },
    });
  });

  it('persiste la sesión y la restaura', (done) => {
    service.login('cliente@demo.com', 'Demo123!').subscribe(() => {
      expect(localStorage.getItem('taller-control:session-user-id')).toContain('user-client-1');
      const fresh = TestBed.runInInjectionContext(() => new AuthService());
      expect(fresh.currentUser?.id).toBe('user-client-1');
      expect(fresh.isMechanic()).toBeFalse();
      done();
    });
  });

  it('cierra sesión', (done) => {
    service.login('mecanico@demo.com', 'Demo123!').subscribe(() => {
      service.logout();
      expect(service.isAuthenticated).toBeFalse();
      done();
    });
  });
});
