/* Captura los diálogos en móvil y verifica que quepan en pantalla. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4321';
const OUT = path.join(__dirname, '..', 'shots', 'dialogs');

const FIT_PROBE = () => {
  const pane = document.querySelector('.cdk-overlay-pane');
  if (!pane) return { found: false };
  const r = pane.getBoundingClientRect();
  return {
    found: true,
    left: Math.round(r.left), right: Math.round(r.right),
    top: Math.round(r.top), bottom: Math.round(r.bottom),
    vw: window.innerWidth, vh: window.innerHeight,
    overflowsX: r.right > window.innerWidth + 1 || r.left < -1,
    overflowsY: r.bottom > window.innerHeight + 1 || r.top < -1,
  };
};

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const vp of [{ n: '390', w: 390, h: 844 }, { n: '375', w: 375, h: 667 }]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', 'mecanico@demo.com');
    await page.fill('input[formcontrolname="password"]', 'Demo123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\//, { timeout: 15000 });

    const shot = async (name) => {
      await page.waitForTimeout(900);
      const fit = await page.evaluate(FIT_PROBE);
      console.log(`${vp.n} · ${name}:`, JSON.stringify(fit));
      await page.screenshot({ path: path.join(OUT, `${vp.n}-${name}.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    };

    // Confirmar (eliminar vehículo)
    await page.goto(`${BASE}/app/vehicles`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.locator('td.tc-cell-actions button').first().click();
    await page.waitForTimeout(400);
    await page.getByRole('menuitem', { name: /Eliminar/ }).click();
    await shot('confirmar');
    await page.keyboard.press('Escape');

    // Nuevo artículo del catálogo
    await page.goto(`${BASE}/app/catalog`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /Nuevo art/ }).click();
    await shot('catalogo-form');

    // Cotización: PDF, compartir y pasar a servicio
    await page.goto(`${BASE}/app/quotations/quotation-1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /Ver PDF/ }).click();
    await shot('pdf-preview');
    await page.getByRole('button', { name: /Compartir/ }).click();
    await shot('compartir');
    const convert = page.getByRole('button', { name: /Pasar a servicio/ });
    if (await convert.count()) { await convert.click(); await shot('pasar-a-servicio'); }

    // Cambiar estado del servicio
    await page.goto(`${BASE}/app/services/service-1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /Cambiar estado/ }).click();
    await shot('cambiar-estado');

    // Visor de tarjeta de circulación (si el vehículo tiene documento)
    await page.goto(`${BASE}/app/vehicles/vehicle-1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const ver = page.getByRole('button', { name: /^Ver$/ });
    if (await ver.count()) { await ver.click(); await shot('visor-documento'); }

    console.log(`${vp.n} errores:`, errors.length ? errors : 'ninguno');
    await ctx.close();
  }
  await browser.close();
})();
