import { TestBed } from '@angular/core/testing';
import { VehicleService } from './vehicle.service';
import { Vehicle } from '../../models';

function newVehicle(plate: string): Omit<Vehicle, 'id' | 'createdAt'> {
  return {
    ownerId: 'client-1', plate, vin: '', brand: 'Toyota', model: 'Corolla', year: 2018,
    color: 'Rojo', type: 'Sedán', engineSize: '1.8L', fuelType: 'Gasolina', transmission: 'Automática',
    mileage: 1000, origin: 'agency', notes: '', active: true,
  };
}

describe('VehicleService (placas duplicadas)', () => {
  let service: VehicleService;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(VehicleService);
  });

  it('crea un vehículo con placa única', (done) => {
    service.create(newVehicle('P-111AAA')).subscribe((v) => {
      expect(v.id).toBeTruthy();
      expect(v.plate).toBe('P-111AAA');
      done();
    });
  });

  it('rechaza una placa duplicada (case-insensitive)', (done) => {
    service.create(newVehicle('P-222BBB')).subscribe(() => {
      service.create(newVehicle('p-222bbb')).subscribe({
        next: () => done.fail('no debía permitir duplicado'),
        error: (e: Error) => { expect(e.message).toContain('placa'); done(); },
      });
    });
  });

  it('sólo el mecánico ejecuta delete (borrado físico)', (done) => {
    service.create(newVehicle('P-333CCC')).subscribe((v) => {
      service.delete(v.id).subscribe(() => {
        service.list().subscribe((all) => {
          expect(all.find((x) => x.id === v.id)).toBeUndefined();
          done();
        });
      });
    });
  });
});
