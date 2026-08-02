/* Sonda puntual para inspeccionar medidas reales de una pantalla. */
const { chromium } = require('playwright');
const BASE = 'http://localhost:4321';
const route = process.argv[2] || '/app/clients';
const width = Number(process.argv[3] || 390);

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', 'mecanico@demo.com');
  await page.fill('input[formcontrolname="password"]', 'Demo123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app\//, { timeout: 15000 });
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const info = await page.evaluate(() => {
    const out = { cells: [], small: [] };
    document.querySelectorAll('td.tc-cell-actions').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out.cells.push({ h: Math.round(r.height), pad: cs.padding, minH: cs.minHeight });
    });
    document.querySelectorAll('button, a[mat-button], a[mat-raised-button], a[mat-stroked-button]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height && r.height < 36) {
        out.small.push({
          text: (el.textContent || '').trim().slice(0, 28),
          cls: (el.className || '').toString().slice(0, 60),
          h: Math.round(r.height), w: Math.round(r.width),
        });
      }
    });
    const lbl = document.querySelector('.mdc-floating-label');
    if (lbl) {
      const r = lbl.getBoundingClientRect();
      out.label = { w: Math.round(r.width), right: Math.round(r.right), max: getComputedStyle(lbl).maxWidth };
    }
    return out;
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
