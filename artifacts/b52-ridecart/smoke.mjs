import { chromium } from '/Users/programming-xcode/Desktop/mc-web/artifacts/multiplayer-browser/node_modules/playwright/index.mjs';
const out = new URL('./', import.meta.url).pathname, port = 5581;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--mute-audio'] });
const errors = [], result = {};
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('blockworld.settings', JSON.stringify({ settingsVersion: 3, soundLevels: { master: 0 }, gamma: 1 })));
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${port}/?silent`);
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click({ timeout: 60000 });
  await page.getByRole('button', { name: 'Create New World', exact: true }).first().click();
  await page.getByRole('button', { name: 'Create New World', exact: true }).last().click();
  await page.waitForFunction(() => window.__mc?.world && !document.querySelector('.mc-screen')?.textContent?.match(/Loading|Building|Generating/), null, { timeout: 120000, polling: 250 });
  await page.waitForTimeout(3000);
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300);
  result.ride = await page.evaluate(async () => {
    const m = window.__mc, w8 = (ms) => new Promise(r => setTimeout(r, ms)), p = m.position;
    const bx = Math.floor(p.x), by = 150, bz = Math.floor(p.z);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 40; dz++) { m.world.set(bx + dx, by - 1, bz + dz, 1, true); for (let y = 0; y < 4; y++) m.world.set(bx + dx, by + y, bz + dz, 0, true); }
    for (let dz = 0; dz <= 40; dz++) m.world.set(bx, by, bz + dz, 61, true); // rails, some powered (27) may not be powered; fine
    for (let dz = 0; dz <= 40; dz++) m.world.set(bx, by, bz + dz, 61, true);
    m.teleport(bx + 0.5, by + 3, bz - 1); await w8(500);
    const cart = m.minecarts.spawnCart(0, { x: bx + 0.5, y: by + 0.6, z: bz + 2.5 }); await w8(400);
    const z0 = cart.z; m.minecarts.mount(cart, m.rider); cart.vz = 0.4; await w8(20);
    const rows = [];
    for (let i = 0; i < 40; i++) {
      await w8(40);
      const c = [...m.objectTracker.entries.entries()].find(([l]) => l === cart)?.[1].client;
      rows.push({ live: +cart.z.toFixed(2), copy: c ? +c.z.toFixed(2) : null, pos: +m.position.z.toFixed(2), py: +m.position.y.toFixed(2), cy: c ? +c.y.toFixed(2) : null });
    }
    m.view(1);
    return { rk: m.minecarts.railKind(m.world, bx, by, Math.floor(cart.z)), blk: m.world.get(bx, by, Math.floor(cart.z)), data: m.world.getData?.(bx, by, Math.floor(cart.z)), cx: cart.x, bx, bz, z0, vz: cart.vz, riding: !!m.rider.vehicle, rows };
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + 'ride.png' });
} catch (e) { result.error = String(e); }
result.errors = errors.slice(0, 8);
console.log(JSON.stringify(result, null, 1));
await browser.close();
