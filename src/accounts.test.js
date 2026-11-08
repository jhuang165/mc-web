import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { World } from './world.js';
import { PROTOCOL, apiBase } from './multiplayer/protocol.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { AccountApi } from './multiplayer/account-api.js';
import { DedicatedClient } from './multiplayer/client.js';
import { AccountStore, normalInvite } from '../server/accounts.js';
import { createDedicatedServer } from '../server/server.js';
import { pngSize, normalizeSkinPixels, acceptedSkinSize, PREVIEW_PARTS, PREVIEW_WIDTH, PREVIEW_HEIGHT } from './skin.js';

const token = 'test-only-not-a-deployed-server-key';
const origin = 'http://localhost:5179';

// A minimal valid PNG (RGBA, no filter) for upload tests.
function png(width, height) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length); return out;
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height, 0x7f); for (let y = 0; y < height; y++) raw[y * (width * 4 + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function fixture() {
  const world = new World('dedicated-test');
  world.spawn = () => ({ x: 64.5, y: 80, z: 64.5 });
  return new DedicatedSimulation({}, { world });
}

test('skin PNG header and 1.7.10 ImageBufferDownload opacity rules', () => {
  assert.deepEqual(pngSize(png(64, 32)), { width: 64, height: 32 });
  assert.equal(pngSize(Buffer.from('GIF89a not a png at all, definitely not')), null);
  assert.ok(acceptedSkinSize(64, 64) && acceptedSkinSize(64, 32) && !acceptedSkinSize(128, 64) && !acceptedSkinSize(64, 48));
  const at = (x, y) => (y * 64 + x) * 4 + 3;
  // A 64 x 64 skin keeps its top half; base areas become opaque.
  const tall = new Uint8ClampedArray(64 * 64 * 4); // all alpha 0
  tall[at(40, 8)] = 255; // a hat pixel, but the hat area also has transparent pixels
  const out = normalizeSkinPixels(tall, 64);
  assert.equal(out.length, 64 * 32 * 4);
  assert.equal(out[at(8, 8)], 255, 'head front forced opaque');
  assert.equal(out[at(20, 20)], 255, 'body forced opaque');
  assert.equal(out[at(40, 8)], 255, 'hat with transparency is kept as drawn');
  assert.equal(out[at(41, 8)], 0);
  // A fully opaque hat area (an old skin painted solid) is cleared entirely.
  const solid = new Uint8ClampedArray(64 * 32 * 4).fill(255);
  const cleared = normalizeSkinPixels(solid, 32);
  assert.equal(cleared[at(40, 8)], 0); assert.equal(cleared[at(63, 0)], 0);
  assert.equal(cleared[at(40, 20)], 255, 'arm region under the hat strip is re-opaqued');
  assert.throws(() => normalizeSkinPixels(new Uint8ClampedArray(48 * 32 * 4), 32));
  // The preview parts stay inside the 64 x 32 skin and the 36 x 32 preview.
  for (const [sx, sy, w, h, dx, dy] of PREVIEW_PARTS) {
    assert.ok(sx + w <= 64 && sy + h <= 32 && dx + w <= PREVIEW_WIDTH && dy + h <= PREVIEW_HEIGHT);
  }
});

test('invite-only accounts: owner key bootstraps an admin, invites are single-use, sessions and lockout', async () => {
  let now = 1_000_000;
  const store = new AccountStore({}, { now: () => now });
  await assert.rejects(store.register({ invite: 'WRONG-CODE1', name: 'Steve', password: 'password1' }, token), { status: 403 });
  const owner = await store.register({ invite: token, name: 'Owner', password: 'owner password' }, token);
  assert.equal(owner.account.admin, true);
  assert.equal(store.authenticate(owner.session).name, 'Owner');
  const { code } = await store.createInvite(owner.account.id);
  assert.match(code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  await assert.rejects(store.register({ invite: code, name: 'owner', password: 'password1' }, token), { status: 409 }, 'names are unique ignoring case');
  await assert.rejects(store.register({ invite: code, name: 'bad name!', password: 'password1' }, token), { status: 400 });
  await assert.rejects(store.register({ invite: code, name: 'Alex', password: 'short' }, token), { status: 400 });
  const alex = await store.register({ invite: code.toLowerCase().replace('-', ' '), name: 'Alex', password: 'password1' }, token);
  assert.equal(alex.account.admin, false);
  assert.equal(normalInvite(' ab-cd '), 'ABCD');
  await assert.rejects(store.register({ invite: code, name: 'Third', password: 'password1' }, token), { status: 403 }, 'an invite admits one account');
  // Passwords and tokens are never stored in the clear.
  const saved = JSON.stringify(store.serialize());
  for (const secret of ['password1', alex.session, code.replace('-', ''), token]) assert.ok(!saved.includes(secret));
  await assert.rejects(store.login({ name: 'alex', password: 'wrong pass' }), { status: 401 });
  assert.equal((await store.login({ name: 'ALEX', password: 'password1' })).account.name, 'Alex');
  for (let i = 0; i < 4; i++) await assert.rejects(store.login({ name: 'Alex', password: 'nope nope' }), { status: 401 });
  await assert.rejects(store.login({ name: 'Alex', password: 'password1' }), { status: 429 }, 'five failures lock the name');
  now += 301_000;
  await store.login({ name: 'Alex', password: 'password1' });
  await store.logout(alex.session);
  assert.equal(store.authenticate(alex.session), null);
  now += 31 * 24 * 3600 * 1000;
  assert.equal(store.authenticate(owner.session), null, 'sessions expire');
  // Restored from its saved form, the account still signs in.
  const restored = new AccountStore(JSON.parse(saved), { now: () => now });
  assert.equal((await restored.login({ name: 'Owner', password: 'owner password' })).account.admin, true);
});

test('account HTTP API: CORS, sign-in, invites, rename and skins reach connected players', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-accounts-')), dataFile = path.join(dir, 'world.json');
  const app = await createDedicatedServer({ port: 0, token, dataFile, simulation: fixture(), tickMs: 10, saveMs: 60000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.port}/api/`;
  assert.equal(apiBase(`ws://127.0.0.1:${app.port}/multiplayer`), base);
  assert.equal(apiBase('wss://ledoge0.tail92abaf.ts.net/multiplayer'), 'https://ledoge0.tail92abaf.ts.net/api/');
  const call = (p, { method = 'GET', headers = {}, body } = {}) => fetch(base + p, { method, headers: { Origin: origin, ...headers }, body });

  const preflight = await call('login', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  assert.equal((await fetch(base + 'login', { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: '{}' })).status, 403);

  // The owner makes an invite with the server key from a shell (no Origin).
  assert.equal((await fetch(base + 'invites', { method: 'POST', headers: { Authorization: 'Bearer wrong' } })).status, 401);
  const invite = await (await fetch(base + 'invites', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })).json();

  // The browser client stores only the session token.
  const storage = new Map(), store = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  const fetchWithOrigin = (url, init) => fetch(url, { ...init, headers: { ...init.headers, Origin: origin } });
  const steve = new AccountApi(`ws://127.0.0.1:${app.port}/multiplayer`, { storage: store, fetch: fetchWithOrigin });
  await assert.rejects(steve.register('Steve', 'password1', 'AAAAA-AAAAA'), /invite code/);
  const account = await steve.register('Steve', 'password1', invite.code);
  assert.equal(account.name, 'Steve');
  assert.ok(![...storage.values()].some(v => v.includes('password1')));
  const again = new AccountApi(`ws://127.0.0.1:${app.port}/multiplayer`, { storage: store, fetch: fetchWithOrigin });
  assert.equal((await again.me()).name, 'Steve', 'the session is remembered per server');
  await assert.rejects(again.invite(), /Only admins/);

  // Joining uses the account's name; a second login replaces the first.
  const join = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin });
    const messages = []; ws.on('message', d => messages.push(JSON.parse(d)));
    await once(ws, 'open'); ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, session: again.session }));
    const until = async pred => { for (let i = 0; i < 300; i++) { const m = messages.find(pred); if (m) return m; await new Promise(r => setTimeout(r, 10)); } throw new Error('timeout'); };
    return { ws, until };
  };
  const first = await join();
  const welcome = await first.until(m => m.type === 'welcome');
  assert.equal(welcome.world.players[0].name, 'Steve'); assert.equal(welcome.world.players[0].skin, null);
  const second = await join();
  const [code, reason] = await once(first.ws, 'close');
  assert.equal(code, 1008); assert.equal(String(reason), 'You logged in from another location');
  await second.until(m => m.type === 'welcome');
  assert.equal(app.simulation.players.size, 1);

  // Skins: only 64 x 32 PNGs, content-addressed and public to fetch.
  await assert.rejects(again.uploadSkin(png(64, 64)), /64 × 32/);
  await assert.rejects(again.request('skin', { method: 'PUT', body: Buffer.alloc(20000), type: 'image/png' }), /too large|16 KB/);
  await assert.rejects(again.request('skin', { method: 'PUT', body: png(64, 32), type: 'image/gif' }), /PNG/);
  const skinned = await again.uploadSkin(png(64, 32));
  assert.match(skinned.skin, /^[a-f0-9]{20}$/);
  const tick = await second.until(m => m.type === 'tick' && m.players[0]?.skin === skinned.skin);
  assert.ok(tick);
  const served = await fetch(again.skinUrl(skinned.skin), { headers: { Origin: origin } });
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.equal(served.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), png(64, 32));

  // Renames are unique and visible to connected players.
  assert.equal((await again.rename('Alex')).name, 'Alex');
  await second.until(m => m.type === 'tick' && m.players[0]?.name === 'Alex');
  await again.clearSkin();
  assert.equal((await fetch(again.skinUrl(skinned.skin))).status, 404);
  await again.signOut();
  assert.equal(storage.size, 0);
  second.ws.close(); await once(second.ws, 'close');
  await app.close();
  const mode = (await stat(path.join(dir, 'accounts.json'))).mode & 0o777;
  assert.equal(mode, 0o600);
  const saved = JSON.parse(await readFile(path.join(dir, 'accounts.json'), 'utf8'));
  assert.equal(saved.accounts.find(a => a.name === 'Alex').admin, false);
});

test('ticks arriving during a slow terrain load merge instead of disconnecting', () => {
  const ticks = [], chats = [];
  const client = new DedicatedClient({ onTick: m => ticks.push(m), onChat: m => chats.push(m) });
  for (let t = 1; t <= 5000; t++) client.buffer({ type: 'tick', tick: t, time: t, changes: t === 1 ? [[1, 2, 3, 4, 0], [5, 5, 5, 1, 0]] : t === 4000 ? [[1, 2, 3, 0, 0]] : [], players: [{ id: 'a', x: t }] });
  for (let i = 0; i < 150; i++) client.buffer({ type: 'chat', name: '', text: 'line ' + i });
  client.start();
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0].tick, 5000); assert.equal(ticks[0].players[0].x, 5000);
  assert.deepEqual(ticks[0].changes.sort(), [[1, 2, 3, 0, 0], [5, 5, 5, 1, 0]], 'each cell keeps its last write');
  assert.equal(chats.length, 100); assert.equal(chats[0].text, 'line 50');
});
