import { TestBed } from '@angular/core/testing';
import { Client, Quotation, Vehicle } from '../../models';
import { QuotationDeliveryService, esDispositivoTactil } from './quotation-delivery.service';
import { QuotationPdfService } from './quotation-pdf.service';
import { WorkshopSettingsService } from './workshop-settings.service';

const quotation = {
  id: 'q1', number: 'COT-0194', clientId: 'c1', vehicleId: 'v1',
  date: '2026-08-31T00:00:00.000Z', validityDays: 15, mileage: 0,
  paymentMethod: '', notes: '', considerations: '', items: [], status: 'sent',
  partsSubtotal: 610, laborSubtotal: 450, discountTotal: 0,
  subtotal: 1060, advance: 0, total: 1060, costTotal: 390, profit: 670,
  createdAt: '', updatedAt: '',
} as Quotation;

const client = {
  id: 'c1', firstName: 'Miguel', lastName: 'Cabrera', taxId: 'CF',
  phone: '3176 6741', whatsapp: '', email: '', address: '', notes: '',
  createdAt: '', active: true,
} as Client;

const vehicle = {
  id: 'v1', ownerId: 'c1', plate: 'P438JKL', vin: '', brand: 'Honda',
  model: 'CR-V', line: 'CR-V LX 4WD', year: 2011, color: '', type: 'SUV',
  engineSize: '2.4', fuelType: '', transmission: '', mileage: 0,
  origin: 'agency', notes: '', createdAt: '', active: true,
} as Vehicle;

describe('QuotationDeliveryService', () => {
  let service: QuotationDeliveryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        QuotationDeliveryService,
        { provide: QuotationPdfService, useValue: { blob: () => Promise.resolve(new Blob()), fileName: () => 'COT-0194.pdf', download: () => Promise.resolve() } },
        {
          provide: WorkshopSettingsService,
          useValue: { current: { name: 'Mundo Garage', currencySymbol: 'Q' } },
        },
      ],
    });
    service = TestBed.inject(QuotationDeliveryService);
  });

  describe('número de WhatsApp', () => {
    it('le antepone 502 a un número guatemalteco de 8 dígitos', () => {
      expect(service.waNumber(client)).toBe('50231766741');
    });

    it('respeta el número si ya trae código de país', () => {
      expect(service.waNumber({ ...client, whatsapp: '502 3176 6741' })).toBe('50231766741');
    });

    it('prefiere el WhatsApp sobre el teléfono cuando son distintos', () => {
      expect(service.waNumber({ ...client, whatsapp: '55551234' })).toBe('50255551234');
    });

    it('devuelve vacío si no hay número usable, para abrir WhatsApp sin destinatario', () => {
      expect(service.waNumber({ ...client, phone: '123', whatsapp: '' })).toBe('');
    });
  });

  describe('mensaje', () => {
    it('nombra el vehículo y la placa, como pidió el taller', () => {
      const msg = service.buildMessage(quotation, client, vehicle);
      expect(msg).toContain('Hola Miguel');
      expect(msg).toContain('tu cotización para Honda CR-V LX 4WD 2011');
      expect(msg).toContain('placa P438JKL');
      expect(msg).toContain('COT-0194');
      expect(msg).toContain('Q 1,060.00');
    });

    it('usa la línea completa y no el modelo corto', () => {
      expect(service.describeVehicle(vehicle)).toBe('Honda CR-V LX 4WD 2011');
      expect(service.describeVehicle({ ...vehicle, line: '' })).toBe('Honda CR-V 2011');
    });
  });

  describe('apertura de WhatsApp', () => {
    it('arma el enlace de wa.me con el número y el texto', () => {
      const url = service.whatsappUrl(quotation, client, vehicle);
      expect(url).toContain('https://wa.me/50231766741?text=');
      expect(decodeURIComponent(url)).toContain('COT-0194');
    });

    it('sin número, abre wa.me sin destinatario', () => {
      const url = service.whatsappUrl(quotation, { ...client, phone: '' }, vehicle);
      expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    });

    it('abre con un enlace de verdad, NO con window.open', () => {
      // window.open puede quedar bloqueado en silencio: sin error y sin pestaña.
      const emergente = spyOn(window, 'open');
      let clicado: HTMLAnchorElement | null = null;
      const crear = document.createElement.bind(document);
      spyOn(document, 'createElement').and.callFake(((tag: string) => {
        const el = crear(tag);
        if (tag === 'a') {
          clicado = el as HTMLAnchorElement;
          spyOn(el, 'click');
        }
        return el;
      }) as typeof document.createElement);

      const r = service.openWhatsApp(quotation, client, vehicle);

      expect(emergente).not.toHaveBeenCalled();
      expect(clicado!.click).toHaveBeenCalled();
      expect(clicado!.href).toContain('wa.me/50231766741');
      expect(clicado!.target).toBe('_blank');
      expect(r.outcome).toBe('opened');
    });

    it('devuelve el enlace para poder dejarlo a la vista después de enviar', () => {
      spyOn(window, 'open');
      const r = service.openWhatsApp(quotation, client, vehicle);
      expect(r.url).toContain('wa.me/50231766741');
    });

    it('no deja el enlace pegado en el documento', () => {
      spyOn(window, 'open');
      const antes = document.querySelectorAll('a').length;
      service.openWhatsApp(quotation, client, vehicle);
      expect(document.querySelectorAll('a').length).toBe(antes);
    });
  });

  describe('cuándo usar el selector del sistema', () => {
    const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141 Safari/537.36';
    const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
    const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36';
    const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/604.1';
    const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141 Safari/537.36';

    it('en el teléfono sí: ahí WhatsApp recibe el PDF adjunto', () => {
      expect(esDispositivoTactil(IPHONE, 5)).toBe(true);
      expect(esDispositivoTactil(ANDROID, 5)).toBe(true);
    });

    it('en la Mac NO, aunque Chrome sepa compartir: abriría el panel de macOS y no WhatsApp', () => {
      expect(esDispositivoTactil(MAC, 0)).toBe(false);
    });

    it('en Windows tampoco', () => {
      expect(esDispositivoTactil(WIN, 0)).toBe(false);
    });

    it('el iPad se anuncia como Macintosh; se reconoce por el táctil', () => {
      expect(esDispositivoTactil(IPAD, 5)).toBe(true);
      expect(esDispositivoTactil(IPAD, 0)).toBe(false);
    });
  });

  describe('imagen al portapapeles', () => {
    // Es el único "adjunto" posible desde la computadora: WhatsApp no acepta
    // archivos por enlace y el portapapeles del navegador no admite PDF.

    it('dice que no se puede si el navegador no tiene ClipboardItem', () => {
      const original = (window as unknown as Record<string, unknown>)['ClipboardItem'];
      delete (window as unknown as Record<string, unknown>)['ClipboardItem'];
      expect(service.canCopyImage()).toBe(false);
      (window as unknown as Record<string, unknown>)['ClipboardItem'] = original;
    });

    it('devuelve false en vez de reventar cuando el portapapeles falla', async () => {
      if (!service.canCopyImage()) { pending('este navegador no soporta el portapapeles'); return; }
      spyOn(navigator.clipboard, 'write').and.returnValue(Promise.reject(new Error('sin foco')));
      const ok = await service.copyImage(new Blob(['x'], { type: 'image/png' }));
      expect(ok).toBe(false);
    });

    it('copia como image/png, que es lo que WhatsApp pega en el chat', async () => {
      if (!service.canCopyImage()) { pending('este navegador no soporta el portapapeles'); return; }
      const write = spyOn(navigator.clipboard, 'write').and.returnValue(Promise.resolve());
      const ok = await service.copyImage(new Blob(['x'], { type: 'image/png' }));
      expect(ok).toBe(true);
      const item = write.calls.mostRecent().args[0][0];
      expect(item.types).toContain('image/png');
    });

    it('el atajo se adapta al sistema', () => {
      expect(service.atajoPegar()).toMatch(/⌘V|Ctrl\+V/);
    });
  });

  describe('compartir archivo', () => {
    it('no intenta compartir si el navegador no soporta archivos', () => {
      expect(service.canShareFile(undefined)).toBe(false);
    });

    it('cae a WhatsApp si el navegador falla al compartir', async () => {
      const file = new File([new Blob()], 'x.pdf', { type: 'application/pdf' });
      (navigator as unknown as { share: unknown }).share = () => Promise.reject(new Error('boom'));
      spyOn(window, 'open').and.returnValue({ closed: false } as Window);
      const r = await service.shareFile(file, quotation, client, vehicle);
      expect(r.outcome).toBe('opened');
    });

    it('cancelar el selector no abre WhatsApp por detrás', async () => {
      const file = new File([new Blob()], 'x.pdf', { type: 'application/pdf' });
      const abort = new Error('cancel');
      abort.name = 'AbortError';
      (navigator as unknown as { share: unknown }).share = () => Promise.reject(abort);
      const abrir = spyOn(window, 'open');
      const r = await service.shareFile(file, quotation, client, vehicle);
      expect(r.outcome).toBe('cancelled');
      expect(abrir).not.toHaveBeenCalled();
    });

    it('al cancelar SÍ devuelve el enlace: en Mac el panel se cierra porque WhatsApp no está en la lista', async () => {
      const file = new File([new Blob()], 'x.pdf', { type: 'application/pdf' });
      const abort = new Error('cancel');
      abort.name = 'AbortError';
      (navigator as unknown as { share: unknown }).share = () => Promise.reject(abort);
      const r = await service.shareFile(file, quotation, client, vehicle);
      expect(r.url).toContain('wa.me/50231766741');
    });

    it('compartir con éxito también devuelve el enlace, por si no llegó a WhatsApp', async () => {
      const file = new File([new Blob()], 'x.pdf', { type: 'application/pdf' });
      (navigator as unknown as { share: unknown }).share = () => Promise.resolve();
      const r = await service.shareFile(file, quotation, client, vehicle);
      expect(r.outcome).toBe('shared');
      expect(r.url).toContain('wa.me/50231766741');
    });
  });
});
