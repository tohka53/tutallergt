/**
 * Genera la IMAGEN de la cotización (la que se copia al portapapeles para
 * pegarla en WhatsApp) y la deja en shots/ para poder mirarla.
 *
 *   node tools/imagen-preview.cjs
 *
 * Existe porque esa imagen es lo que ve el cliente en el chat: si sale
 * recortada, con fondo transparente o ilegible, no hay prueba unitaria que lo
 * note. Rasteriza EL MISMO PDF que se manda, con el mismo código de la app.
 *
 * Requiere playwright (npm i -D playwright). En contenedor:
 *   PLAYWRIGHT_CHROMIUM=/ruta/al/chrome node tools/imagen-preview.cjs
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'shots');
const WORKER = path.join(RAIZ, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');

const STUB_ANGULAR = `
export function Injectable() { return function (t) { return t; }; }
export function inject(token) { return new token(); }
`;

const STUB_SETTINGS = `
export const LOGO_POR_OMISION = '';
export class WorkshopSettingsService {
  constructor() {
    this.current = {
      name: 'Mundo Garage', slogan: '', logoDataUrl: globalThis.__LOGO__ || '',
      email: 'mundogarage134@gmail.com', phone: '54116453', address: '', taxId: '',
      currencySymbol: 'Q', maxUploadMb: 5,
      colors: { black: '#111111', yellow: '#FFC107', white: '#FFFFFF', blue: '#1565C0' },
    };
  }
}
`;

const ENTRADA = `
import { QuotationImageService } from './src/app/core/services/quotation-image.service';
globalThis.generarImagen = async function (datos) {
  const svc = new QuotationImageService();
  const blob = await svc.build(datos.quotation, datos.client, datos.vehicle);
  const buf = new Uint8Array(await blob.arrayBuffer());
  return { bytes: Array.from(buf), tipo: blob.type, tam: blob.size };
};
`;

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

function cotizacionDePrueba() {
  const items = [
    { id: '1', type: 'part', code: 'FRE-CAB-010', name: 'Cable de Freno de Mano',
      quantity: 1, unitCost: 390, unitPrice: 610, discount: 0, note: '', subtotal: 610, costSubtotal: 390 },
    { id: '2', type: 'labor', code: 'MO-FRE-035', name: 'MO Cambio de Cable de Freno de Mano',
      quantity: 1, unitCost: 0, unitPrice: 450, discount: 0, note: '', subtotal: 450, costSubtotal: 0 },
  ];
  return {
    quotation: {
      id: 'q1', number: 'COT-0194', clientId: 'c1', vehicleId: 'v1',
      date: new Date(2026, 7, 31).toISOString(), validityDays: 15, mileage: 148500,
      paymentMethod: 'Efectivo / Transferencia', notes: '', considerations: '',
      items, status: 'sent',
      partsSubtotal: 610, laborSubtotal: 450, discountTotal: 0,
      subtotal: 1060, advance: 0, total: 1060, costTotal: 390, profit: 670,
      createdAt: '', updatedAt: '',
    },
    client: { id: 'c1', firstName: 'Miguel', lastName: 'Cabrera', taxId: 'CF',
      phone: '3176 6741', whatsapp: '', email: '', address: '', notes: '', createdAt: '', active: true },
    vehicle: { id: 'v1', ownerId: 'c1', plate: 'P438JKL', vin: '', brand: 'Honda',
      model: 'CR-V', line: 'CR-V LX 4WD', year: 2011, color: 'Gris', type: 'SUV',
      engineSize: '2.4', fuelType: 'Gasolina', transmission: 'Automática',
      mileage: 148500, origin: 'agency', notes: '', createdAt: '', active: true },
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
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}
  );
  const ctx = await browser.newContext();
  // Una página vacía servida por http, para que 'assets/...' resuelva como
  // ruta relativa igual que en la app (con about:blank no resolvería).
  await ctx.route('http://localhost/', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })
  );
  // La app sirve el worker desde assets/; aquí se sirve desde node_modules.
  await ctx.route('**/assets/pdf.worker.min.mjs', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(WORKER) })
  );

  const page = await ctx.newPage();
  const problemas = [];
  page.on('console', (m) => { if (m.type() === 'error') { problemas.push(m.text()); } });
  page.on('pageerror', (e) => problemas.push('pageerror: ' + e.message));

  await page.goto('http://localhost/');
  await page.evaluate((l) => { globalThis.__LOGO__ = 'data:image/png;base64,' + l; }, logo);
  await page.addScriptTag({ content: codigo });

  const r = await page.evaluate((d) => globalThis.generarImagen(d), cotizacionDePrueba());
  await browser.close();

  const destino = path.join(SALIDA, 'cotizacion-imagen.png');
  fs.writeFileSync(destino, Buffer.from(r.bytes));
  console.log('Listo:', destino, '·', r.tipo, '·', Math.round(r.tam / 1024) + ' KB');
  if (problemas.length) { console.log('Avisos de consola:', problemas.slice(0, 5)); }
})();
