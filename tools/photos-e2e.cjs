/* Verificación de extremo a extremo de la evidencia fotográfica.
   Requiere el bundle compilado y `node tools/serve-dist.cjs` en el puerto 4321.
   Uso: node tools/photos-e2e.cjs                                             */
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = path.join(__dirname, '..', '.audit-photos');
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? '  OK  ' : ' FALLA'}  ${name}${extra ? '  — ' + extra : ''}`);
}

async function login(page, email) {
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' });
  await page.fill('input[formControlName="email"]', email);
  await page.fill('input[formControlName="password"]', 'Demo123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(app|portal)\//, { timeout: 15000 });
  await page.waitForTimeout(600);
}

async function logout(page) {
  await page.evaluate(() => localStorage.removeItem('taller-control:session-user-id'));
}

/* Genera una foto de prueba con el canvas del propio navegador, para que el
   script no dependa de archivos externos ni de librerías de imagen. */
async function makePhoto(page, name, w, h, label) {
  const dataUrl = await page.evaluate(({ w, h, label }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#46464e'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#786e5a'; x.lineWidth = 8;
    for (let i = 0; i < w; i += 120) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i - h / 3, h); x.stroke();
    }
    x.fillStyle = '#302c28'; x.strokeStyle = '#c8aa3c'; x.lineWidth = 24;
    x.beginPath();
    x.ellipse(w / 2, h / 2, w * 0.21, h * 0.25, 0, 0, Math.PI * 2);
    x.fill(); x.stroke();
    x.fillStyle = '#ffdc5a'; x.font = 'bold 48px sans-serif';
    x.fillText(label, 60, 90);
    return c.toDataURL('image/jpeg', 0.92);
  }, { w, h, label });
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') };
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // Fotos de prueba: una horizontal grande y una vertical, para comprobar que
  // se reducen y que la orientación se conserva.
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' });
  const BALATAS = await makePhoto(page, 'balatas.jpg', 2400, 1800, 'BALATA - DESGASTE');
  const ROTOR = await makePhoto(page, 'rotor.jpg', 1800, 2400, 'ROTOR RAYADO');
  const NO_IMAGEN = { name: 'nota.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 falso') };

  // ============ MECÁNICO ============
  await login(page, 'mecanico@demo.com');
  await page.goto(BASE + '/app/services/service-1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const card = page.locator('app-service-photos');
  check('La tarjeta de evidencia aparece en el detalle del servicio', await card.count() === 1);
  check('Arranca vacía con el mensaje para el mecánico',
    (await card.locator('.ph-empty').innerText()).includes('Aún no has subido'));
  check('El contador arranca en 0 / 3', (await card.locator('.ph-count').innerText()).includes('0 / 3'));

  // --- subir dos fotos de una sola vez ---
  await card.locator('input[type=file]').setInputFiles([BALATAS, ROTOR]);
  await page.waitForTimeout(2500);
  check('Se suben dos fotos en una sola selección',
    await card.locator('figure.photo').count() === 2);
  check('El contador refleja 2 / 3', (await card.locator('.ph-count').innerText()).includes('2 / 3'));

  const thumbs = card.locator('figure.photo .thumb img');
  const loaded = await thumbs.evaluateAll((imgs) => imgs.map((i) => i.naturalWidth > 0));
  check('Las miniaturas se dibujan (blob leído de IndexedDB)', loaded.every(Boolean),
    JSON.stringify(loaded));

  // --- la imagen guardada está reducida ---
  const stored = await page.evaluate(async () => {
    const metas = JSON.parse(localStorage.getItem('taller-control:service-photos') || '[]');
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('taller-control-files', 1);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const out = [];
    for (const m of metas) {
      const blob = await new Promise((res) => {
        const tx = db.transaction('blobs', 'readonly');
        const q = tx.objectStore('blobs').get(m.blobKey);
        q.onsuccess = () => res(q.result);
      });
      const bmp = await createImageBitmap(blob);
      out.push({ meta: m.size, blob: blob.size, type: blob.type, w: bmp.width, h: bmp.height });
    }
    return out;
  });
  check('El binario queda en IndexedDB con los metadatos en localStorage', stored.length === 2);
  check('Las fotos se reducen a 1600px de lado mayor',
    stored.every((s) => Math.max(s.w, s.h) <= 1600), JSON.stringify(stored.map((s) => `${s.w}x${s.h}`)));
  check('El tamaño guardado coincide con el metadato',
    stored.every((s) => s.meta === s.blob));
  check('La orientación vertical se conserva',
    stored.some((s) => s.h > s.w), JSON.stringify(stored.map((s) => `${s.w}x${s.h}`)));

  // --- nota por foto ---
  const cap = card.locator('figure.photo').first().locator('input[matInput]');
  await cap.fill('Balatas al límite');
  await cap.blur();
  await page.waitForTimeout(400);
  const savedCaption = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('taller-control:service-photos'))[0].caption);
  check('La nota del mecánico se guarda al salir del campo', savedCaption === 'Balatas al límite',
    savedCaption);

  // --- visor ampliado ---
  await card.locator('figure.photo .thumb').first().click();
  await page.waitForTimeout(700);
  const dlg = page.locator('app-photo-viewer-dialog');
  check('El visor ampliado abre', await dlg.count() === 1);
  check('El visor muestra el contador de posición',
    (await dlg.locator('.counter').innerText()).includes('1 de 2'));
  await dlg.locator('button[aria-label="Foto siguiente"]').click();
  await page.waitForTimeout(400);
  check('La flecha siguiente avanza',
    (await dlg.locator('.counter').innerText()).includes('2 de 2'));
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(400);
  check('La flecha izquierda del teclado retrocede',
    (await dlg.locator('.counter').innerText()).includes('1 de 2'));
  await page.screenshot({ path: path.join(OUT, '03-visor-escritorio.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(OUT, '01-mecanico-escritorio.png'), fullPage: true });

  // --- rechazo de formato (con cupo disponible, para llegar a la validación MIME) ---
  const dismissSnack = async () => {
    await page.locator('.mat-mdc-snack-bar-action button').click().catch(() => {});
    await page.waitForTimeout(400);
  };
  await dismissSnack();
  await card.locator('input[type=file]').evaluate((el) => el.removeAttribute('accept'));
  await card.locator('input[type=file]').setInputFiles([NO_IMAGEN]);
  await page.waitForTimeout(900);
  let snackText = await page.locator('.mat-mdc-snack-bar-label').last().innerText().catch(() => '');
  check('Rechaza un PDF aunque se salte el filtro del selector',
    snackText.includes('Formato no permitido'), snackText);
  check('El PDF rechazado no se guarda', await card.locator('figure.photo').count() === 2);
  await dismissSnack();

  // --- tope de 3 ---
  await card.locator('input[type=file]').setInputFiles([BALATAS]);
  await page.waitForTimeout(2000);
  check('Se llega a 3 fotos', await card.locator('figure.photo').count() === 3);
  const addBtn = card.locator('.photos-foot button');
  check('El botón de agregar se deshabilita al llegar al límite',
    await addBtn.isDisabled());
  check('El pie explica cómo liberar cupo',
    (await card.locator('.foot-hint').innerText()).includes('Elimine una foto'));

  // --- una cuarta foto se rechaza aunque se fuerce el input ---
  await dismissSnack();
  await card.locator('input[type=file]').setInputFiles([ROTOR]);
  await page.waitForTimeout(900);
  snackText = await page.locator('.mat-mdc-snack-bar-label').last().innerText().catch(() => '');
  check('La cuarta foto se rechaza con un mensaje que dice qué hacer',
    snackText.includes('Ya hay 3 fotos'), snackText);
  check('Siguen siendo 3 fotos', await card.locator('figure.photo').count() === 3);
  await dismissSnack();

  // ============ CLIENTE ============
  await logout(page);
  await login(page, 'cliente@demo.com');
  await page.waitForTimeout(800);

  const badge = page.locator('.status-item .s-photos');
  check('El panel del cliente avisa que hay fotos',
    (await badge.count()) > 0 && (await badge.first().innerText()).includes('3 fotos'),
    await badge.first().innerText().catch(() => 'sin insignia'));

  await page.goto(BASE + '/portal/services/service-1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const cCard = page.locator('app-service-photos');
  check('El cliente ve la tarjeta de evidencia', await cCard.count() === 1);
  check('El cliente ve las 3 fotos', await cCard.locator('figure.photo').count() === 3);
  const cLoaded = await cCard.locator('figure.photo .thumb img')
    .evaluateAll((imgs) => imgs.map((i) => i.naturalWidth > 0));
  check('Las fotos se dibujan para el cliente', cLoaded.every(Boolean));
  check('El cliente ve la nota del mecánico',
    (await cCard.locator('.caption-text').first().innerText()).includes('Balatas al límite'));
  check('El cliente NO tiene campo para editar la nota',
    await cCard.locator('input[matInput]').count() === 0);
  check('El cliente NO tiene botón de eliminar',
    await cCard.locator('button:has-text("Eliminar")').count() === 0);
  check('El cliente NO tiene botón de subir',
    await cCard.locator('button:has-text("Agregar foto")').count() === 0);

  await cCard.locator('figure.photo .thumb').first().click();
  await page.waitForTimeout(700);
  check('El cliente puede ampliar la foto',
    await page.locator('app-photo-viewer-dialog img').count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '02-cliente-escritorio.png'), fullPage: true });

  // ============ MÓVIL ============
  for (const w of [360, 390, 768]) {
    await page.setViewportSize({ width: w, height: 780 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`Sin desborde horizontal a ${w}px`, overflow <= 1, `desborde=${overflow}px`);
    // < 640px: una foto por fila. 640-900px: dos por fila, como las tablas-tarjeta.
    const cols = w >= 640 ? 2 : 1;
    const box = await page.locator('app-service-photos figure.photo').first().boundingBox();
    check(`La foto ocupa su columna a ${w}px (${cols} por fila)`,
      box && box.width > (w / cols) * 0.72,
      box ? Math.round(box.width) + 'px' : 'sin caja');
    if (w === 390) {
      await page.screenshot({ path: path.join(OUT, '04-cliente-movil.png'), fullPage: true });
      await page.locator('app-service-photos figure.photo .thumb').first().click();
      await page.waitForTimeout(800);
      const pane = await page.locator('.cdk-overlay-pane.mat-mdc-dialog-panel').boundingBox();
      check('El visor cabe en la pantalla del teléfono', pane && pane.width <= 390,
        pane ? Math.round(pane.width) + 'px' : 'sin caja');
      const arrows = await Promise.all(['Foto anterior', 'Foto siguiente'].map(async (label) => {
        const box = await page.locator(`button[aria-label="${label}"]`).boundingBox();
        return !!box && box.x >= 0 && box.x + box.width <= 390;
      }));
      check('Ambas flechas del visor quedan a la vista en el teléfono',
        arrows.every(Boolean), JSON.stringify(arrows));
      await page.screenshot({ path: path.join(OUT, '05-visor-movil.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  }

  // ============ BORRADO EN CASCADA ============
  await page.setViewportSize({ width: 1440, height: 900 });
  await logout(page);
  await login(page, 'mecanico@demo.com');
  await page.goto(BASE + '/app/services/service-1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.locator('button:has-text("Eliminar")').first().click();
  await page.waitForTimeout(600);
  await page.locator('.mat-mdc-dialog-container button:has-text("Eliminar")').click();
  await page.waitForTimeout(1500);
  const leftovers = await page.evaluate(async () => {
    const metas = JSON.parse(localStorage.getItem('taller-control:service-photos') || '[]');
    const db = await new Promise((res) => {
      const r = indexedDB.open('taller-control-files', 1); r.onsuccess = () => res(r.result);
    });
    const keys = await new Promise((res) => {
      const tx = db.transaction('blobs', 'readonly');
      const q = tx.objectStore('blobs').getAllKeys();
      q.onsuccess = () => res(q.result);
    });
    return { metas: metas.length, blobs: keys.filter((k) => String(k).startsWith('svc-photo-')).length };
  });
  check('Al eliminar el servicio se borran los metadatos', leftovers.metas === 0, JSON.stringify(leftovers));
  check('Al eliminar el servicio no quedan blobs huérfanos', leftovers.blobs === 0, JSON.stringify(leftovers));

  check('Sin errores de consola en todo el recorrido', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
  console.log('Capturas en ' + OUT);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
