import { TestBed } from '@angular/core/testing';
import { VehicleDocumentService } from './vehicle-document.service';

function fakeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

describe('VehicleDocumentService (validación de archivos)', () => {
  let service: VehicleDocumentService;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(VehicleDocumentService);
  });

  it('acepta un PDF dentro del tamaño permitido', () => {
    expect(service.validate(fakeFile('tarjeta.pdf', 'application/pdf', 1024))).toBeNull();
  });

  it('acepta imágenes JPG y PNG', () => {
    expect(service.validate(fakeFile('t.jpg', 'image/jpeg', 2048))).toBeNull();
    expect(service.validate(fakeFile('t.png', 'image/png', 2048))).toBeNull();
  });

  it('rechaza tipos MIME no permitidos (no sólo por extensión)', () => {
    // El nombre dice .pdf pero el tipo real es distinto
    const bad = fakeFile('malicioso.pdf', 'application/x-msdownload', 1024);
    expect(service.validate(bad)).toContain('Formato no permitido');
  });

  it('rechaza archivos que superan el tamaño máximo', () => {
    const big = fakeFile('grande.pdf', 'application/pdf', 6 * 1024 * 1024);
    expect(service.validate(big)).toContain('máximo');
  });
});
