/**
 * Genera un PDF de cotización de prueba y lo convierte a PNG para poder mirarlo.
 *
 * Existe porque el PDF es el documento que el cliente recibe por WhatsApp: un
 * `ng build` sin errores no dice nada sobre si la tabla se salió del margen o
 * si el logo tapa el número de cotización. Esto lo dibuja de verdad.
 *
 *   node tools/pdf-preview.cjs           # escribe shots/cotizacion.pdf y .png
 *
 * Requiere playwright (npm i -D playwright). El servicio se empaqueta con
 * esbuild sustituyendo Angular y la configuración del taller por dobles, así
 * que se prueba EL MISMO código que corre en la app, sin levantar Angular.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'shots');

const STUB_ANGULAR = `
export function Injectable() { return function (t) { return t; }; }
export function inject(token) { return new token(); }
`;

const STUB_SETTINGS = `
export const LOGO_POR_OMISION = '';
export class WorkshopSettingsService {
  constructor() {
    this.current = {
      name: 'Mundo Garage',
      slogan: 'Donde el mundo se pone en marcha',
      logoDataUrl: globalThis.__LOGO__ || '',
      email: 'mundogarage134@gmail.com',
      phone: '54116453',
      address: '',
      taxId: '',
      currencySymbol: 'Q',
      maxUploadMb: 5,
      colors: { black: '#111111', yellow: '#FFC107', white: '#FFFFFF', blue: '#1565C0' },
    };
  }
}
`;

const ENTRADA = `
import { QuotationPdfService } from './src/app/core/services/quotation-pdf.service';

globalThis.generar = async function (datos) {
  const svc = new QuotationPdfService();
  const doc = await svc.build(datos.quotation, datos.client, datos.vehicle);
  return doc.output('datauristring');
};
`;

/** Doble en memoria para los imports que dependen de Angular. */
const plugin = {
  name: 'dobles',
  setup(build) {
    build.onResolve({ filter: /^@angular\/core$/ }, () => ({ path: 'stub-angular', namespace: 'stub' }));
    build.onResolve({ filter: /workshop-settings\.service$/ }, () => ({ path: 'stub-settings', namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
      contents: args.path === 'stub-angular' ? STUB_ANGULAR : STUB_SETTINGS,
      loader: 'js',
    }));
  },
};

/**
 * Con `node tools/pdf-preview.cjs --largo` se genera una cotización de 22
 * líneas y con anticipo, para comprobar el salto de página y que el bloque de
 * totales no se parta a la mitad.
 */
const LARGO = process.argv.includes('--largo');

function cotizacionDePrueba() {
  const items = LARGO ? Array.from({ length: 22 }, (_, i) => ({
    id: String(i), type: i % 3 === 2 ? 'labor' : 'part', code: 'X-' + i,
    name: 'Artículo de prueba número ' + (i + 1) + ' con un nombre bastante largo',
    quantity: (i % 4) + 1, unitCost: i % 3 === 2 ? 0 : 100 + i,
    unitPrice: 180 + i * 7, discount: 0, note: '',
    subtotal: ((i % 4) + 1) * (180 + i * 7), costSubtotal: 0,
  })) : [
    { id: '1', type: 'part', code: 'FRE-CAB-010', name: 'Cable de Freno de Mano',
      quantity: 1, unitCost: 390, unitPrice: 610, discount: 0, note: '', subtotal: 610, costSubtotal: 390 },
    { id: '2', type: 'labor', code: 'MO-FRE-035', name: 'MO Cambio de Cable de Freno de Mano',
      quantity: 1, unitCost: 0, unitPrice: 450, discount: 0, note: '', subtotal: 450, costSubtotal: 0 },
  ];
  return {
    quotation: {
      id: 'q1', number: 'COT-0194', clientId: 'c1', vehicleId: 'v1',
      date: new Date(2026, 7, 31).toISOString(), validityDays: 15, mileage: 148500,
      paymentMethod: 'Efectivo / Transferencia',
      notes: '', considerations: '',
      items, status: 'sent',
      partsSubtotal: 610, laborSubtotal: 450, discountTotal: 0,
      subtotal: LARGO ? items.reduce((s, i) => s + i.subtotal, 0) : 1060,
      advance: LARGO ? 1500 : 0,
      total: LARGO ? items.reduce((s, i) => s + i.subtotal, 0) - 1500 : 1060,
      costTotal: 390, profit: 670,
      createdAt: '', updatedAt: '',
    },
    client: {
      id: 'c1', firstName: 'Miguel', lastName: 'Cabrera', taxId: 'CF',
      phone: '5555 5555', whatsapp: '', email: '', address: '', notes: '',
      createdAt: '', active: true,
    },
    vehicle: {
      id: 'v1', ownerId: 'c1', plate: '438JKL', vin: '', brand: 'Honda',
      model: 'CR-V', line: 'Cr-v Lx 4wd', year: 2011, color: 'Gris', type: 'SUV',
      engineSize: '2.4', fuelType: 'Gasolina', transmission: 'Automática',
      mileage: 148500, origin: 'agency', notes: '', createdAt: '', active: true,
    },
  };
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });

  const bundle = await esbuild.build({
    stdin: { contents: ENTRADA, resolveDir: RAIZ, loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020',
    plugins: [plugin],
  });
  const codigo = bundle.outputFiles[0].text;

  const logo = fs.readFileSync(path.join(RAIZ, 'src/assets/logo-mundo-garage.png')).toString('base64');

  const { chromium } = require('playwright');
  // En contenedores el navegador ya viene instalado en otra ruta; se usa el que
  // haya en PLAYWRIGHT_CHROMIUM en vez de bajar uno nuevo.
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}
  );
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') { console.error('[consola]', m.text()); } });
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.evaluate((l) => { globalThis.__LOGO__ = 'data:image/png;base64,' + l; }, logo);
  await page.addScriptTag({ content: codigo });

  const dataUri = await page.evaluate((d) => globalThis.generar(d), cotizacionDePrueba());
  await browser.close();

  const base64 = dataUri.split(',')[1];
  const nombre = LARGO ? 'cotizacion-larga' : 'cotizacion';
  const pdf = path.join(SALIDA, nombre + '.pdf');
  fs.writeFileSync(pdf, Buffer.from(base64, 'base64'));

  const { execSync } = require('child_process');
  try {
    execSync(`pdftoppm -png -r 110 "${pdf}" "${path.join(SALIDA, nombre)}"`);
  } catch {
    console.log('(pdftoppm no disponible: sólo se generó el PDF)');
  }
  console.log('Listo:', pdf);
})();
