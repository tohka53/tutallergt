/* Auditoría visual: recorre las pantallas en varios tamaños, detecta desbordes
   horizontales y toma capturas. Uso: node tools/visual-audit.cjs            */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = path.join(__dirname, '..', 'shots');

const VIEWPORTS = [
  { name: '375-iphone-se', width: 375, height: 667, mobile: true },
  { name: '390-iphone14', width: 390, height: 844, mobile: true },
  { name: '768-tablet', width: 768, height: 1024, mobile: true },
  { name: '1440-desktop', width: 1440, height: 900, mobile: false },
];

const MECHANIC = [
  ['dashboard', '/app/dashboard'],
  ['clients', '/app/clients'],
  ['client-detail', '/app/clients/client-1'],
  ['client-form', '/app/clients/client-1/edit'],
  ['vehicles', '/app/vehicles'],
  ['vehicle-detail', '/app/vehicles/vehicle-1'],
  ['vehicle-form', '/app/vehicles/vehicle-1/edit'],
  ['vehicle-history', '/app/vehicles/vehicle-1/history'],
  ['quotations', '/app/quotations'],
  ['quotation-detail', '/app/quotations/quotation-1'],
  ['quotation-form', '/app/quotations/quotation-1/edit'],
  ['services', '/app/services'],
  ['service-detail', '/app/services/service-1'],
  ['service-form', '/app/services/service-1/edit'],
  ['catalog', '/app/catalog'],
  ['settings', '/app/settings'],
];

const CLIENT = [
  ['portal-dashboard', '/portal/dashboard'],
  ['portal-profile', '/portal/profile'],
  ['portal-vehicles', '/portal/vehicles'],
  ['portal-quotations', '/portal/quotations'],
  ['portal-services', '/portal/services'],
];

const OVERFLOW_PROBE = () => {
  const docW = document.documentElement.clientWidth;
  const offenders = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.right > docW + 1 || r.left < -1) {
      const style = getComputedStyle(el);
      if (style.position === 'fixed' && r.width <= docW + 1) return;
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '')
          .toString().slice(0, 70),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
  });
  // Sólo el desborde más externo de cada rama importa; recortamos la lista.
  return {
    scrollW: document.documentElement.scrollWidth,
    clientW: docW,
    bodyScrollW: document.body.scrollWidth,
    offenders: offenders.slice(0, 8),
  };
};

const TAP_PROBE = () => {
  const small = [];
  document.querySelectorAll('button, a[mat-button], a[mat-raised-button], a[mat-stroked-button], [role="button"]')
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.height < 36) {
        small.push({ text: (el.textContent || '').trim().slice(0, 30), h: Math.round(r.height) });
      }
    });
  return small.slice(0, 6);
};

async function login(page, email) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('input[formcontrolname="password"]', 'Demo123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(app|portal)\//, { timeout: 15000 });
  await page.waitForTimeout(600);
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const report = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    const dir = path.join(OUT, vp.name);
    fs.mkdirSync(dir, { recursive: true });

    for (const [role, routes, email] of [
      ['mech', MECHANIC, 'mecanico@demo.com'],
      ['client', CLIENT, 'cliente@demo.com'],
    ]) {
      await login(page, email);
      // Login screenshot (una sola vez por viewport)
      if (role === 'mech') {
        await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(dir, '00-login.png'), fullPage: true });
        // (el login sí usa el scroll del documento)
        report.push({ vp: vp.name, page: 'login', ...(await page.evaluate(OVERFLOW_PROBE)) });
        await login(page, email);
      }

      for (const [name, route] of routes) {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(700);
        const probe = await page.evaluate(OVERFLOW_PROBE);
        const taps = await page.evaluate(TAP_PROBE);
        report.push({ vp: vp.name, page: name, ...probe, smallTaps: taps.length });
        // El scroll ocurre dentro de .tc-content, así que fullPage no sirve:
        // agrandamos temporalmente el alto del viewport para ver la pantalla completa.
        const needed = await page.evaluate(() => {
          const c = document.querySelector('.tc-content');
          return c ? c.scrollHeight + 80 : document.documentElement.scrollHeight;
        });
        const tall = Math.min(Math.max(needed, vp.height), 6000);
        if (tall > vp.height) { await page.setViewportSize({ width: vp.width, height: tall }); await page.waitForTimeout(250); }
        await page.screenshot({ path: path.join(dir, `${name}.png`) });
        if (tall > vp.height) { await page.setViewportSize({ width: vp.width, height: vp.height }); await page.waitForTimeout(150); }
      }
    }

    // Menú lateral abierto en móvil
    if (vp.mobile) {
      await login(page, 'mecanico@demo.com');
      await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const burger = page.locator('.tc-header button').first();
      await burger.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(dir, 'zz-menu-open.png') });
    }

    report.push({ vp: vp.name, page: '__console_errors__', errors: [...new Set(errors)].slice(0, 10) });
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

  const bad = report.filter((r) => r.offenders && r.offenders.length);
  console.log('=== DESBORDE HORIZONTAL ===');
  if (!bad.length) console.log('ninguno');
  bad.forEach((r) => console.log(`${r.vp} · ${r.page}: scrollW=${r.scrollW} clientW=${r.clientW}`,
    JSON.stringify(r.offenders)));

  const taps = report.filter((r) => r.smallTaps > 0);
  console.log('\n=== BOTONES < 36px ===');
  console.log(taps.length ? taps.map((t) => `${t.vp}/${t.page}: ${t.smallTaps}`).join(', ') : 'ninguno');

  const errs = report.filter((r) => r.page === '__console_errors__' && r.errors.length);
  console.log('\n=== ERRORES DE CONSOLA ===');
  console.log(errs.length ? JSON.stringify(errs, null, 2) : 'ninguno');
})();
