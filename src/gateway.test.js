import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';
import { createGateway } from '../server/gateway.js';
import { createProfileServer } from '../server/profile-server.js';
import { ProfileApi } from './profile.js';
import { encodePng } from './png-codec.js';

const origin = 'https://game.example';
const storage = () => { const m = new Map(); return { getItem: k => m.get(k), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const fetchOrigin = (url, init = {}) => fetch(url, { ...init, headers: { ...init.headers, Origin: origin } });

// A stand-in for server/guns-server.js: GET /status (answered after the body ends) and a WebSocket echo on /multiplayer.
async function startGame() {
  const seen = { http: [], upgrades: [] };
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', ws => ws.on('message', (data, binary) => ws.send(data, { binary })));
  const server = http.createServer((req, res) => {
    const entry = { method: req.method, url: req.url, headers: req.headers, length: 0, complete: false, closed: false };
    seen.http.push(entry);
    req.on('data', chunk => { entry.length += chunk.length; });
    req.on('close', () => { entry.closed = true; });
    req.on('end', () => {
      entry.complete = true;
      if (req.url.split('?')[0] !== '/status') { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Game': 'fake' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ online: true, players: 0 }));
    });
  });
  server.on('upgrade', (req, socket, head) => {
    seen.upgrades.push({ url: req.url, headers: req.headers });
    if (req.url.split('?')[0] !== '/multiplayer') { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, seen, close: async () => { for (const ws of wss.clients) ws.terminate(); await new Promise(resolve => server.close(resolve)); } };
}

const deadPort = async () => {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
};

// Raw HTTP client: unlike fetch it sends paths such as /api/skins/../x unnormalized and lets us set any header.
function raw(port, method, pathname, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers, agent: false }, res => {
      const parts = [];
      res.on('data', d => parts.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(parts).toString() }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

const wsOutcome = (url, options = {}) => new Promise(resolve => {
  const ws = new WebSocket(url, options);
  ws.on('open', () => { ws.terminate(); resolve({ open: true }); });
  ws.on('unexpected-response', (req, res) => { resolve({ status: res.statusCode }); res.resume(); req.destroy(); });
  ws.on('error', error => resolve({ error: error.message }));
});

const until = async (check, ms = 2000) => {
  for (const end = Date.now() + ms; Date.now() < end;) { if (check()) return true; await new Promise(r => setTimeout(r, 10)); }
  return check();
};

let dir, profiles, game, gateway, base;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-gateway-'));
  profiles = await createProfileServer({ port: 0, file: path.join(dir, 'accounts.json'), origins: [origin] });
  game = await startGame();
  gateway = await createGateway({ port: 0, profiles: `http://127.0.0.1:${profiles.port}`, game: `http://127.0.0.1:${game.port}` });
  base = `http://127.0.0.1:${gateway.port}`;
});
after(async () => {
  await gateway?.close(); await game?.close(); await profiles?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

test('gateway forwards register, login, me, logout and skins to the accounts service with the session as a bearer token', async () => {
  const json = { 'Content-Type': 'application/json' };
  const register = await fetchOrigin(base + '/api/register', { method: 'POST', headers: json, body: JSON.stringify({ name: 'GateUser', email: 'gate@example.org', password: 'synthetic password' }) });
  assert.equal(register.status, 201);
  assert.equal(register.headers.get('access-control-allow-origin'), origin);
  const { session } = await register.json();
  assert.match(session, /^[A-Za-z0-9_-]+$/);
  const me = await fetchOrigin(base + '/api/me?fresh=1', { headers: { Authorization: 'Bearer ' + session } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).account.name, 'GateUser');
  const login = await fetchOrigin(base + '/api/login', { method: 'POST', headers: json, body: JSON.stringify({ name: 'gate@example.org', password: 'synthetic password' }) });
  assert.equal(login.status, 200);
  const second = (await login.json()).session;
  assert.equal((await fetchOrigin(base + '/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + second } })).status, 204);
  assert.equal((await fetchOrigin(base + '/api/me', { headers: { Authorization: 'Bearer ' + second } })).status, 401);
  assert.equal((await fetchOrigin(base + '/api/me', { headers: { Authorization: 'Bearer ' + session } })).status, 200);

  // The browser client's own code path (rename, skin upload/fetch/clear) works unchanged against the gateway.
  const api = new ProfileApi(base + '/api/', { storage: storage(), fetch: fetchOrigin });
  assert.equal((await api.signIn('GateUser', 'synthetic password')).name, 'GateUser');
  assert.equal((await api.rename('GateRenamed')).name, 'GateRenamed');
  const account = await api.uploadSkin(await encodePng(64, 32, new Uint8Array(64 * 32 * 4).fill(200)));
  assert.match(account.skin, /^[a-f0-9]{20}$/);
  const png = await fetch(api.skinUrl(account.skin));
  assert.equal(png.status, 200); assert.equal(png.headers.get('content-type'), 'image/png');
  assert.equal((await raw(gateway.port, 'HEAD', `/api/skins/${account.skin}.png`)).status, 200);
  await api.clearSkin();
  assert.equal((await fetch(api.skinUrl(account.skin))).status, 404);
});

test('CORS preflight passes through with the accounts service headers; disallowed origins get its 403', async () => {
  const preflight = await raw(gateway.port, 'OPTIONS', '/api/register', { headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], origin);
  assert.match(preflight.headers['access-control-allow-methods'], /POST/);
  assert.match(preflight.headers['access-control-allow-headers'], /Authorization/);
  const skin = await raw(gateway.port, 'OPTIONS', '/api/skin', { headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT' } });
  assert.equal(skin.status, 204);
  const denied = await raw(gateway.port, 'OPTIONS', '/api/me', { headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
});

test('everything outside the route table is a 404 that never reaches an upstream', async () => {
  const before = game.seen.http.length;
  const refused = [
    ['GET', '/'], ['GET', '/index.html'], ['GET', '/mods/tacz/x.json'], ['GET', '/api/unknown'], ['GET', '/api/skins/../x'],
    ['GET', '/api/login'], ['POST', '/api/invites'], ['GET', '/api/me/'], ['GET', '/api/accounts.json'], ['GET', '/%2e%2e/accounts.json'],
    ['GET', '/api/skins/ABCDEF0123456789ABCD.png'], ['GET', '/api/skins/abcdef0123456789abc.png'], ['GET', '/api/skins/abcdef0123456789abcd.png/x'],
    ['GET', '/health/'], ['HEAD', '/health'], ['GET', '/status/'], ['POST', '/status'], ['OPTIONS', '/status'], ['GET', '/multiplayer'],
    ['OPTIONS', '/'], ['DELETE', '/api/me'], ['GET', '/world.json'], ['GET', '/saves/'], ['GET', 'http://127.0.0.1/status'],
  ];
  for (const [method, url] of refused) {
    const reply = await raw(gateway.port, method, url);
    assert.equal(reply.status, 404, `${method} ${url}`);
    if (method !== 'HEAD') assert.deepEqual(JSON.parse(reply.text), { error: 'Not found.' }, `${method} ${url}`);
  }
  assert.equal(game.seen.http.length, before, 'no refused request reached the game service');
});

test('health is answered by the gateway itself without upstream addresses', async () => {
  const reply = await raw(gateway.port, 'GET', '/health');
  assert.equal(reply.status, 200);
  assert.deepEqual(JSON.parse(reply.text), { ok: true, service: 'gateway', upstreams: { profiles: true, game: true } });
  assert.ok(!reply.text.includes('127.0.0.1') && !reply.text.includes(String(profiles.port)) && !reply.text.includes(String(game.port)));
});

test('game status and WebSocket upgrades on /multiplayer reach the game service with Origin preserved', async () => {
  const status = await fetch(base + '/status?probe=1');
  assert.equal(status.status, 200);
  assert.equal(status.headers.get('x-game'), 'fake');
  assert.deepEqual(await status.json(), { online: true, players: 0 });
  assert.equal((await raw(gateway.port, 'HEAD', '/status')).status, 200);

  const ws = new WebSocket(`ws://127.0.0.1:${gateway.port}/multiplayer?room=a`, { origin });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const echoed = new Promise(resolve => ws.once('message', (data, binary) => resolve({ text: data.toString(), binary })));
  ws.send('hello through the gateway');
  assert.deepEqual(await echoed, { text: 'hello through the gateway', binary: false });
  const bytes = new Promise(resolve => ws.once('message', (data, binary) => resolve({ data, binary })));
  ws.send(Buffer.from([1, 2, 3, 250]));
  const reply = await bytes;
  assert.equal(reply.binary, true); assert.deepEqual([...reply.data], [1, 2, 3, 250]);
  ws.close(); await new Promise(resolve => ws.once('close', resolve));
  const upgrade = game.seen.upgrades.at(-1);
  assert.equal(upgrade.url, '/multiplayer?room=a');
  assert.equal(upgrade.headers.origin, origin);
  assert.equal(upgrade.headers.host, `127.0.0.1:${game.port}`);
  assert.ok(upgrade.headers['sec-websocket-key']);
});

test('WebSocket upgrades on any other path are refused by the gateway', async () => {
  const before = game.seen.upgrades.length;
  for (const pathname of ['/other', '/multiplayer/', '/api/me', '/status', '/']) {
    assert.deepEqual(await wsOutcome(`ws://127.0.0.1:${gateway.port}${pathname}`, { origin }), { status: 404 }, pathname);
  }
  assert.equal(game.seen.upgrades.length, before);
});

test('client forwarding headers are stripped, never added, and Authorization/Host are handled per hop', async () => {
  const spoof = { 'X-Forwarded-For': '203.0.113.9', 'X-Forwarded-Proto': 'http', 'X-Forwarded-Host': 'evil.example', Forwarded: 'for=203.0.113.9', 'X-Real-IP': '203.0.113.9', 'Proxy-Authorization': 'Basic eA==' };
  const reply = await raw(gateway.port, 'GET', '/status', { headers: { ...spoof, Authorization: 'Bearer token-for-upstream', Origin: origin, Host: 'ledoge0.example' } });
  assert.equal(reply.status, 200);
  const seen = game.seen.http.at(-1).headers;
  for (const name of ['x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host', 'forwarded', 'x-real-ip', 'proxy-authorization']) assert.equal(seen[name], undefined, name);
  assert.equal(seen.authorization, 'Bearer token-for-upstream');
  assert.equal(seen.origin, origin);
  assert.equal(seen.host, `127.0.0.1:${game.port}`);

  const ws = new WebSocket(`ws://127.0.0.1:${gateway.port}/multiplayer`, { origin, headers: { 'X-Forwarded-For': '203.0.113.9', Forwarded: 'for=203.0.113.9' } });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  ws.terminate();
  const upgrade = game.seen.upgrades.at(-1).headers;
  assert.equal(upgrade['x-forwarded-for'], undefined); assert.equal(upgrade.forwarded, undefined);
  assert.equal(upgrade.origin, origin);
});

test('oversize request bodies are refused with 413 and the upstream request is aborted', async () => {
  const declared = await raw(gateway.port, 'POST', '/api/login', { headers: { 'Content-Type': 'application/json', 'Content-Length': 70000 }, body: Buffer.alloc(70000, 0x20) });
  assert.equal(declared.status, 413);
  assert.deepEqual(JSON.parse(declared.text), { error: 'Request too large.' });

  // Chunked body: send the first chunk, wait until the game service is receiving it, then overflow the cap.
  const before = game.seen.http.length;
  const chunked = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: gateway.port, method: 'GET', path: '/status', headers: { 'Transfer-Encoding': 'chunked' }, agent: false }, res => {
      const parts = []; res.on('data', d => parts.push(d)); res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString() }));
    });
    req.on('error', reject);
    req.write(Buffer.alloc(16384, 0x61));
    until(() => game.seen.http.length > before && game.seen.http.at(-1).length > 0).then(() => {
      for (let i = 0; i < 7; i++) req.write(Buffer.alloc(16384, 0x61));
      req.end();
    });
  });
  assert.equal(chunked.status, 413);
  assert.deepEqual(JSON.parse(chunked.text), { error: 'Request too large.' });
  assert.equal(game.seen.http.length, before + 1);
  const entry = game.seen.http.at(-1);
  assert.ok(await until(() => entry.closed), 'upstream request was torn down');
  assert.equal(entry.complete, false);
  assert.ok(entry.length <= 64 * 1024);

  // A body within the cap still streams through (the accounts service applies its own smaller limits).
  const small = await raw(gateway.port, 'POST', '/api/login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'nobody', password: 'wrong password' }) });
  assert.equal(small.status, 401);
});

test('a stopped game service gives 502 for status and WebSockets while account login keeps working', async t => {
  const down = await createGateway({ port: 0, profiles: `http://127.0.0.1:${profiles.port}`, game: `http://127.0.0.1:${await deadPort()}` });
  t.after(() => down.close());
  const status = await raw(down.port, 'GET', '/status');
  assert.equal(status.status, 502);
  assert.deepEqual(JSON.parse(status.text), { error: 'Service unavailable.' });
  assert.deepEqual(await wsOutcome(`ws://127.0.0.1:${down.port}/multiplayer`, { origin }), { status: 502 });
  const login = await fetchOrigin(`http://127.0.0.1:${down.port}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'GateRenamed', password: 'synthetic password' }) });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).account.name, 'GateRenamed');
  assert.deepEqual(JSON.parse((await raw(down.port, 'GET', '/health')).text), { ok: true, service: 'gateway', upstreams: { profiles: true, game: false } });
});

test('a stopped accounts service gives 502 for account routes while game status keeps working', async t => {
  const down = await createGateway({ port: 0, profiles: `http://127.0.0.1:${await deadPort()}`, game: `http://127.0.0.1:${game.port}` });
  t.after(() => down.close());
  const me = await raw(down.port, 'GET', '/api/me', { headers: { Authorization: 'Bearer abc', Origin: origin } });
  assert.equal(me.status, 502);
  assert.deepEqual(JSON.parse(me.text), { error: 'Service unavailable.' });
  assert.equal((await raw(down.port, 'GET', '/status')).status, 200);
  assert.deepEqual(await wsOutcome(`ws://127.0.0.1:${down.port}/multiplayer`, { origin }).then(r => r.open), true);
  assert.deepEqual(JSON.parse((await raw(down.port, 'GET', '/health')).text), { ok: true, service: 'gateway', upstreams: { profiles: false, game: true } });
});

test('closing the gateway tears down open WebSocket tunnels', async () => {
  const extra = await createGateway({ port: 0, profiles: `http://127.0.0.1:${profiles.port}`, game: `http://127.0.0.1:${game.port}` });
  const ws = new WebSocket(`ws://127.0.0.1:${extra.port}/multiplayer`, { origin });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const closed = new Promise(resolve => ws.once('close', resolve));
  await extra.close();
  await closed;
  await assert.rejects(createGateway({ port: 0, profiles: 'https://127.0.0.1:8090' }), /Invalid profiles upstream/);
  await assert.rejects(createGateway({ port: 0, game: 'http://127.0.0.1:8091/static/' }), /Invalid game upstream/);
});
