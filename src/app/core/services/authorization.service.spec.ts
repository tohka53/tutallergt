import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AuthorizationService } from './authorization.service';
import { Client, User, Vehicle } from '../../models';

const users: User[] = [
  { id: 'user-mechanic', email: 'm@demo.com', displayName: 'Carlos', role: 'mechanic', active: true, createdAt: '2024-01-01' },
  { id: 'user-client-1', email: 'c1@demo.com', displayName: 'Ana', role: 'client', clientId: 'client-1', active: true, createdAt: '2024-01-01' },
];
const vehicleOfClient1 = { id: 'v1', ownerId: 'client-1' } as Vehicle;
const vehicleOfClient2 = { id: 'v2', ownerId: 'client-2' } as Vehicle;

describe('AuthorizationService (restricciones por rol)', () => {
  let auth: AuthService;
  let authz: AuthorizationService;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('taller-control:users', JSON.stringify(users));
    TestBed.configureTestingModule({});
    auth = TestBed.inject(AuthService);
    authz = TestBed.inject(AuthorizationService);
  });

  it('sólo el mecánico puede eliminar vehículos', (done) => {
    auth.login('m@demo.com', 'Demo123!').subscribe(() => {
      expect(authz.canDeleteVehicle()).toBeTrue();
      auth.login('c1@demo.com', 'Demo123!').subscribe(() => {
        expect(authz.canDeleteVehicle()).toBeFalse();
        done();
      });
    });
  });

  it('el cliente sólo accede a sus propios vehículos', (done) => {
    auth.login('c1@demo.com', 'Demo123!').subscribe(() => {
      expect(authz.canAccessVehicle(vehicleOfClient1)).toBeTrue();
      expect(authz.canAccessVehicle(vehicleOfClient2)).toBeFalse();
      done();
    });
  });

  it('el mecánico accede a cualquier cliente', (done) => {
    auth.login('m@demo.com', 'Demo123!').subscribe(() => {
      expect(authz.canAccessClient('client-1')).toBeTrue();
      expect(authz.canAccessClient('client-2')).toBeTrue();
      done();
    });
  });

  it('el cliente no puede editar datos de otro cliente', (done) => {
    auth.login('c1@demo.com', 'Demo123!').subscribe(() => {
      expect(authz.canEditClient({ id: 'client-1' } as Client)).toBeTrue();
      expect(authz.canEditClient({ id: 'client-2' } as Client)).toBeFalse();
      done();
    });
  });
});
