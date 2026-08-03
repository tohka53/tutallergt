/* Auditoría de comportamiento móvil: verifica que el DOCUMENTO haga scroll (y no
   un contenedor interno), que la barra superior quede pegada arriba, que el menú
   lateral abra y cierre, y que al enfocar un campo el teclado no lo tape.
   Uso: node tools/mobile-scroll-audit.cjs                                      */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:4321';

const VIEWPORTS = [
  { name: '360-android', width: 360, height: 640 },
  { name: '375-iphone-se', width: 375, height: 667 },
  { name: '390-iphone14', width: 390, height: 844 },
  { name: '768-tablet', width: 768, height: 1024 },
];

/* Páginas con contenido largo garantizado. */
const LONG_PAGES = [
  ['dashboard', '/app/dashboard'],
  ['quotation-form', '/app/quotations/quotation-1/edit'],
  ['vehicle-form', '/app/vehicles/vehicle-1/edit'],
  ['service-detail', '/app/services/service-1'],
];

/* Alto aproximado que ocupa el teclado en pantalla. */
const KEYBOARD_H = 300;

async function login(page, email) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('input[formcontrolname="password"]', 'Demo123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(app|portal)\//, { timeout: 15000 });
  await page.waitForTimeout(600);
}

const fail = [];
const note = (ok, msg) => { console.log(`${ok ? '  ok  ' : ' FALLA'} ${msg}`); if (!ok) fail.push(msg); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await login(page, 'mecanico@demo.com');

    for (const [name, route] of LONG_PAGES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);

      // 1. El documento debe ser más alto que la ventana y poder desplazarse.
      const metrics = await page.evaluate(() => ({
        docScroll: document.documentElement.scrollHeight,
        winH: window.innerHeight,
      }));
      if (metrics.docScroll <= metrics.winH + 4) {
        note(false, `${name}: el documento NO crece (scrollHeight=${metrics.docScroll} <= ventana=${metrics.winH}); el scroll quedó atrapado en un contenedor interno`);
        continue;
      }

      // Se compara contra el máximo real de la página: hay pantallas que en
      // tablet apenas sobrepasan la ventana y no pueden desplazarse 400px.
      const maxScroll = metrics.docScroll - metrics.winH;
      const objetivo = Math.min(400, maxScroll);
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(250);
      const y = await page.evaluate(() => window.scrollY);
      note(y >= objetivo - 2,
        `${name}: el documento se desplaza (scrollY=${Math.round(y)} de ${Math.round(maxScroll)} disponibles)`);

      // 2. La barra superior sigue visible tras desplazar (position: sticky).
      const header = await page.evaluate(() => {
        const h = document.querySelector('.tc-header');
        if (!h) return null;
        const r = h.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
      });
      note(header && header.bottom > 0 && header.top <= 2,
        `${name}: la barra superior queda fija arriba (top=${header && header.top})`);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
    }

    // 3. Teclado: al enfocar un campo bajo, debe quedar por encima del teclado.
    await page.goto(`${BASE}/app/vehicles/vehicle-1/edit`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const inputs = page.locator('input.mat-mdc-input-element:visible');
    const n = await inputs.count();
    if (n > 1) {
      const target = inputs.nth(n - 1); // el último campo del formulario
      await target.scrollIntoViewIfNeeded();
      await target.focus();
      await page.waitForTimeout(400);
      // Simulamos el teclado encogiendo la ventana como hace el navegador móvil.
      await page.setViewportSize({ width: vp.width, height: vp.height - KEYBOARD_H });
      await page.waitForTimeout(300);
      await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      const box = await target.boundingBox();
      const visH = vp.height - KEYBOARD_H;
      note(box && box.y >= -2 && box.y + box.height <= visH + 2,
        `teclado: el campo enfocado queda visible (y=${box && Math.round(box.y)}, alto útil=${visH})`);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);
    }

    // 4. Menú lateral: abre, tapa el contenido y cierra.
    await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.locator('.tc-header button').first().click();
    await page.waitForTimeout(700);
    const nav = await page.evaluate(() => {
      const el = document.querySelector('.tc-sidenav');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width), visible: r.width > 0 && r.left > -5 };
    });
    note(nav && nav.visible, `menú lateral abre (izquierda=${nav && nav.left}, ancho=${nav && nav.width})`);

    const backdrop = await page.locator('.mat-drawer-backdrop').count();
    note(backdrop > 0, 'menú lateral muestra el fondo oscuro para cerrarlo');

    if (backdrop > 0) {
      await page.locator('.mat-drawer-backdrop').first().click({ force: true });
      await page.waitForTimeout(700);
      const closed = await page.evaluate(() => {
        const el = document.querySelector('.tc-sidenav');
        const r = el.getBoundingClientRect();
        return r.left + r.width <= 5 || getComputedStyle(el).visibility === 'hidden';
      });
      note(closed, 'menú lateral cierra al tocar fuera');
    }

    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== RESULTADO: ${fail.length ? fail.length + ' FALLAS' : 'todo en orden'} ===`);
  fail.forEach((f) => console.log(' - ' + f));
  process.exit(fail.length ? 1 : 0);
})();
