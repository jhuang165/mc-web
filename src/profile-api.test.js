import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProfileServer } from '../server/profile-server.js';
import { AccountStore } from '../server/accounts.js';
import { ProfileApi } from './profile.js';
import { encodePng, decodePng } from './png-codec.js';
import { normalizeSkinPixels } from './skin.js';

const origin = 'https://game.example';
const storage = () => { const m = new Map(); return { getItem: k => m.get(k), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), values: () => [...m.values()] }; };

test('public profile API registers unique username/email accounts, preserves sessions and stores only password/token hashes', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-profiles-')), file = path.join(dir, 'accounts.json');
  const app = await createProfileServer({ port: 0, file, origins: [origin] });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.port}/api/`, local = storage();
  const fetchOrigin = (url, init) => fetch(url, { ...init, headers: { ...init.headers, Origin: origin } });
  const api = new ProfileApi(base, { storage: local, fetch: fetchOrigin });
  await assert.rejects(api.me(), /Sign in/);
  await assert.rejects(api.register('Alice', 'bad-email', 'synthetic password'), /email/);
  const first = await api.register('Alice', ' ALICE@Example.org ', 'synthetic password');
  assert.equal(first.email, 'alice@example.org'); assert.equal(first.name, 'Alice'); assert.equal(first.admin, false);
  assert.equal(app.accounts.authenticate(api.session).passwordParams.p, 5);
  const session = api.session;
  await assert.rejects(api.register('alice', 'different@example.org', 'synthetic password'), /name is taken/);
  await assert.rejects(api.register('OtherName', 'Alice@EXAMPLE.ORG', 'synthetic password'), /email address/);
  assert.ok(local.values().every(v => !v.includes('synthetic password') && !v.includes('alice@example.org')));
  const again = new ProfileApi(base, { storage: local, fetch: fetchOrigin });
  assert.equal((await again.me()).id, first.id);
  assert.equal((await api.rename('NewAlice')).name, 'NewAlice');
  await again.signOut();
  await assert.rejects(api.me(), /Sign in/);
  assert.equal(api.session, null);
  assert.equal((await api.signIn('ALICE@example.org', 'synthetic password')).name, 'NewAlice');
  assert.equal((await api.signIn('newalice', 'synthetic password')).email, first.email);
  assert.equal('email' in app.accounts.public(app.accounts.authenticate(api.session)), false, 'email stays out of public presence records');
  const persisted = await readFile(file, 'utf8');
  assert.ok(!persisted.includes('synthetic password') && !persisted.includes(session) && !persisted.includes(api.session));
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const restored = await AccountStore.open(file, { openRegistration: true, requireEmail: true });
  assert.equal(restored.authenticate(api.session).name, 'NewAlice');
  const denied = await fetch(base + 'me', { headers: { Origin: 'https://untrusted.example' } }); assert.equal(denied.status, 403);
  const preflight = await fetch(base + 'register', { method: 'OPTIONS', headers: { Origin: origin } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  for (const route of ['invites', '../multiplayer', '../accounts.json']) assert.equal((await fetch(new URL(route, base))).status, 404);
});

test('profile skin uploads are bounded, decoded and normalized before persistence; invalid images are refused', async t => {
  const accounts = new AccountStore({}, { openRegistration: true, requireEmail: true });
  const app = await createProfileServer({ port: 0, accounts, origins: [origin] }); t.after(() => app.close());
  const base = `http://127.0.0.1:${app.port}/api/`, api = new ProfileApi(base, { storage: storage() });
  await api.register('SkinnedUser', 'skin@example.org', 'synthetic password');
  const pixels = new Uint8Array(64 * 32 * 4).fill(127), png = await encodePng(64, 32, pixels);
  const account = await api.uploadSkin(png);
  const response = await fetch(api.skinUrl(account.skin));
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/png');
  const decoded = await decodePng(new Uint8Array(await response.arrayBuffer()));
  assert.deepEqual(decoded.data, new Uint8Array(normalizeSkinPixels(pixels, 32)));
  await assert.rejects(api.uploadSkin(png.slice(0, 33)), /Invalid PNG/);
  await assert.rejects(api.uploadSkin(await encodePng(128, 32, new Uint8Array(128 * 32 * 4))), /64 × 32/);
  await assert.rejects(api.uploadSkin(new Uint8Array(17000)), /too large/);
  await assert.rejects(api.request('skin', { method: 'PUT', body: png, type: 'image/gif' }), /PNG/);
  await api.clearSkin(); assert.equal((await fetch(api.skinUrl(account.skin))).status, 404);
});

test('username/email uniqueness survives concurrent signup and alternate identifiers share password lockout', async () => {
  let now = 0;
  const store = new AccountStore({}, { openRegistration: true, requireEmail: true, now: () => now });
  const race = await Promise.allSettled(['First', 'Second'].map(name => store.register({ name, email: 'same@example.org', password: 'synthetic password' })));
  assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
  const a = [...store.accounts.values()][0];
  for (let i = 0; i < 5; i++) await assert.rejects(store.login({ name: i % 2 ? a.name : 'SAME@EXAMPLE.ORG', password: 'wrong password' }), { status: 401 });
  await assert.rejects(store.login({ name: a.email, password: 'synthetic password' }), { status: 429 });
  now += 301000;
  assert.equal((await store.login({ name: a.email, password: 'synthetic password' })).account.id, a.id);
});

test('legacy account hashes remain usable and upgrade when signed into the public profile service', async () => {
  const old = new AccountStore({}, { openRegistration: true, requireEmail: true });
  await old.register({ name: 'LegacyUser', email: 'legacy@example.org', password: 'synthetic password' });
  const saved = old.serialize(); delete saved.accounts[0].passwordParams;
  const modern = new AccountStore(saved, { openRegistration: true, requireEmail: true, passwordParams: { N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 } });
  const result = await modern.login({ name: 'legacy@example.org', password: 'synthetic password' });
  assert.equal(modern.authenticate(result.session).passwordParams.p, 5);
  await modern.login({ name: 'LegacyUser', password: 'synthetic password' });
  const legacyReader = new AccountStore(modern.serialize());
  const login = await legacyReader.login({ name: 'LegacyUser', password: 'synthetic password' });
  assert.equal(legacyReader.authenticate(login.session).passwordParams.p, 5, 'a legacy reader does not downgrade a stronger stored hash');
});
