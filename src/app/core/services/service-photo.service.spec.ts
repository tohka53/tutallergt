import { TestBed } from '@angular/core/testing';
import { ServicePhotoService } from './service-photo.service';
import { StorageService } from './storage.service';
import { ServicePhoto } from '../../models';

function fakeImage(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

function photo(serviceId: string, id: string): ServicePhoto {
  return {
    id,
    serviceId,
    caption: '',
    fileName: id + '.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    blobKey: 'svc-photo-' + id,
    uploadedAt: new Date().toISOString(),
    uploadedById: 'u1',
    uploadedByName: 'Mecánico',
  };
}

describe('ServicePhotoService (evidencia fotográfica)', () => {
  let service: ServicePhotoService;
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    storage = TestBed.inject(StorageService);
    service = TestBed.inject(ServicePhotoService);
  });

  it('acepta JPG, PNG y WEBP dentro del tamaño permitido', () => {
    expect(service.validate('s1', fakeImage('pieza.jpg', 'image/jpeg', 2048))).toBeNull();
    expect(service.validate('s1', fakeImage('pieza.png', 'image/png', 2048))).toBeNull();
    expect(service.validate('s1', fakeImage('pieza.webp', 'image/webp', 2048))).toBeNull();
  });

  it('rechaza PDF y otros formatos no visualizables', () => {
    expect(service.validate('s1', fakeImage('doc.pdf', 'application/pdf', 1024)))
      .toContain('Formato no permitido');
    expect(service.validate('s1', fakeImage('foto.heic', 'image/heic', 1024)))
      .toContain('Formato no permitido');
  });

  it('rechaza el tipo MIME real aunque la extensión diga .jpg', () => {
    const bad = fakeImage('pieza.jpg', 'application/x-msdownload', 1024);
    expect(service.validate('s1', bad)).toContain('Formato no permitido');
  });

  it('rechaza imágenes que superan el tamaño máximo configurado', () => {
    const big = fakeImage('grande.jpg', 'image/jpeg', 6 * 1024 * 1024);
    expect(service.validate('s1', big)).toContain('máximo');
  });

  it('permite un máximo de 3 fotos por servicio', () => {
    storage.set('service-photos', [photo('s1', 'a'), photo('s1', 'b')]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServicePhotoService);

    expect(service.countFor('s1')).toBe(2);
    expect(service.remainingSlots('s1')).toBe(1);
    expect(service.validate('s1', fakeImage('c.jpg', 'image/jpeg', 1024))).toBeNull();
  });

  it('rechaza la cuarta foto del mismo servicio', () => {
    storage.set('service-photos', [photo('s1', 'a'), photo('s1', 'b'), photo('s1', 'c')]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServicePhotoService);

    expect(service.remainingSlots('s1')).toBe(0);
    expect(service.validate('s1', fakeImage('d.jpg', 'image/jpeg', 1024)))
      .toContain('Máximo 3 fotos');
  });

  it('el cupo se cuenta por servicio, no globalmente', () => {
    storage.set('service-photos', [photo('s1', 'a'), photo('s1', 'b'), photo('s1', 'c')]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServicePhotoService);

    expect(service.validate('s2', fakeImage('otra.jpg', 'image/jpeg', 1024))).toBeNull();
  });

  it('listForService devuelve sólo las fotos del servicio pedido', (done) => {
    storage.set('service-photos', [photo('s1', 'a'), photo('s2', 'x'), photo('s1', 'b')]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServicePhotoService);

    service.listForService('s1').subscribe((list) => {
      expect(list.map((p) => p.id)).toEqual(['a', 'b']);
      done();
    });
  });
});
