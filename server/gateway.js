// Loopback gateway so one public HTTPS hostname can reach the accounts service and the gun-world game service.
// It forwards an explicit allow-list of routes only: no static files, packs, saves or directory listings.
// Client-supplied forwarding headers are dropped and none are added (IP bans need trusted forwarding first).
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// profile-server.js caps JSON bodies at 4 KiB and skin uploads at MAX_SKIN_BYTES (16 KiB); 64 KiB is the larger bound.
const BODY_LIMIT = 64 * 1024;
const HEALTH_TIMEOUT = 1000, HEALTH_CACHE = 2000;
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'te', 'trailer', 'trailers', 'transfer-encoding', 'upgrade', 'expect']);
const SKIN = /^\/api\/skins\/[a-f0-9]{20}\.png$/;
const PROFILE_ROUTES = new Map([
  ['/api/register', ['POST']], ['/api/login', ['POST']], ['/api/logout', ['POST']],
  ['/api/me', ['GET', 'PATCH']], ['/api/skin', ['PUT', 'DELETE']],
]);
const GAME_ROUTES = new Map([['/status', ['GET', 'HEAD']]]);
const SOCKET_PATH = '/multiplayer';

const upstreamUrl = (value, name) => {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(`Invalid ${name} upstream URL.`);
  return { hostname: url.hostname.replace(/^\[|\]$/g, ''), port: +url.port || 80, host: url.host };
};

// Raw path before the query string; matched exactly, never normalized, so what is matched is what is forwarded.
const rawPath = url => { const i = url.indexOf('?'); return i < 0 ? url : url.slice(0, i); };

const profileMethods = pathname => PROFILE_ROUTES.get(pathname) ?? (SKIN.test(pathname) ? ['GET', 'HEAD'] : null);

function route(method, url) {
  if (!url.startsWith('/')) return null;
  const pathname = rawPath(url);
  if (method === 'GET' && pathname === '/health') return 'health';
  const profile = profileMethods(pathname);
  if (profile && (profile.includes(method) || method === 'OPTIONS')) return 'profiles';
  if (GAME_ROUTES.get(pathname)?.includes(method)) return 'game';
  return null;
}

const dropped = (name, listed) => HOP_BY_HOP.has(name) || listed.has(name) || name.startsWith('proxy-') || name.startsWith('x-forwarded-') || name === 'forwarded' || name === 'x-real-ip';
const connectionList = value => new Set(String(value ?? '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean));

function filterHeaders(headers) {
  const listed = connectionList(headers.connection), out = {};
  for (const [name, value] of Object.entries(headers)) if (value !== undefined && !dropped(name, listed)) out[name] = value;
  return out;
}

const replyJson = (res, status, value) => {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
};

function proxy(req, res, target, { bodyLimit, timeoutMs }) {
  const declared = req.headers['content-length'];
  if (declared !== undefined && !(+declared <= bodyLimit)) { req.resume(); return replyJson(res, 413, { error: 'Request too large.' }); }
  const headers = filterHeaders(req.headers);
  headers.host = target.host;
  if (declared === undefined && req.headers['transfer-encoding']) headers['transfer-encoding'] = 'chunked';
  let failed = false, responded = false, length = 0;
  const upstream = http.request({ hostname: target.hostname, port: target.port, method: req.method, path: req.url, headers, agent: false, timeout: timeoutMs });
  const fail = (status, error) => {
    if (failed) return;
    failed = true; upstream.destroy(); req.resume(); // drain the rest; requestTimeout bounds a client that keeps sending
    if (responded) res.destroy(); else replyJson(res, status, { error });
  };
  upstream.on('timeout', () => fail(502, 'Service unavailable.'));
  upstream.on('error', () => fail(502, 'Service unavailable.'));
  upstream.on('response', up => {
    if (failed) { up.resume(); return; }
    responded = true;
    res.writeHead(up.statusCode, up.statusMessage, filterHeaders(up.headers));
    up.on('error', () => res.destroy());
    up.on('close', () => { if (!up.complete) res.destroy(); });
    up.pipe(res);
  });
  req.on('data', chunk => {
    if (failed) return;
    length += chunk.length;
    if (length > bodyLimit) { if (responded) { failed = true; req.resume(); } else fail(413, 'Request too large.'); return; }
    if (!upstream.write(chunk)) { req.pause(); upstream.once('drain', () => req.resume()); }
  });
  req.on('end', () => { if (!failed) upstream.end(); });
  req.on('error', () => upstream.destroy());
  res.on('close', () => { failed = true; upstream.destroy(); req.resume(); });
}

function probe(target, pathname) {
  return new Promise(resolve => {
    const req = http.request({ hostname: target.hostname, port: target.port, method: 'GET', path: pathname, headers: { host: target.host }, agent: false, timeout: HEALTH_TIMEOUT }, res => {
      res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

function tunnel(req, socket, head, target, { timeoutMs, tunnels }) {
  const listed = connectionList(req.headers.connection);
  listed.delete('upgrade'); // the upgrade itself is the point of this hop
  const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    const name = req.rawHeaders[i], lower = name.toLowerCase(), value = req.rawHeaders[i + 1];
    if (lower === 'host') continue;
    if (lower.startsWith('x-forwarded-') || lower === 'forwarded' || lower === 'x-real-ip' || lower.startsWith('proxy-') || (listed.has(lower) && lower !== 'connection')) continue;
    lines.push(`${name}: ${value}`);
  }
  lines.splice(1, 0, `Host: ${target.host}`);
  const upstream = net.connect({ host: target.hostname, port: target.port });
  tunnels.add(socket); tunnels.add(upstream);
  let connected = false;
  const destroyBoth = () => { socket.destroy(); upstream.destroy(); };
  const finish = other => () => { if (typeof other.destroySoon === 'function') other.destroySoon(); else other.destroy(); };
  socket.on('close', () => { tunnels.delete(socket); if (connected) finish(upstream)(); else upstream.destroy(); });
  upstream.on('close', () => { tunnels.delete(upstream); if (connected) finish(socket)(); });
  socket.on('error', destroyBoth);
  upstream.setTimeout(timeoutMs, () => upstream.destroy(new Error('connect timeout')));
  upstream.on('error', () => {
    if (connected) { destroyBoth(); return; }
    upstream.destroy();
    if (!socket.destroyed) { socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n'); finish(socket)(); }
  });
  upstream.on('connect', () => {
    connected = true; upstream.setTimeout(0);
    upstream.write(lines.join('\r\n') + '\r\n\r\n');
    if (head?.length) upstream.write(head);
    socket.pipe(upstream); upstream.pipe(socket);
  });
}

export async function createGateway({ port = 8092, bind = '127.0.0.1', profiles = 'http://127.0.0.1:8090', game = 'http://127.0.0.1:8091', bodyLimit = BODY_LIMIT, timeoutMs = 15000 } = {}) {
  const targets = { profiles: upstreamUrl(profiles, 'profiles'), game: upstreamUrl(game, 'game') };
  const tunnels = new Set();
  let health = null;
  const checkHealth = () => {
    if (!health || Date.now() - health.at > HEALTH_CACHE) {
      health = { at: Date.now(), value: Promise.all([probe(targets.profiles, '/health'), probe(targets.game, '/status')]).then(([p, g]) => ({ profiles: p, game: g })) };
    }
    return health.value;
  };
  const server = http.createServer((req, res) => {
    const target = route(req.method, req.url);
    if (target === 'health') {
      req.resume();
      checkHealth().then(upstreams => replyJson(res, 200, { ok: true, service: 'gateway', upstreams }), () => replyJson(res, 200, { ok: true, service: 'gateway' }));
      return;
    }
    if (!target) { req.resume(); return replyJson(res, 404, { error: 'Not found.' }); }
    proxy(req, res, targets[target], { bodyLimit, timeoutMs });
  });
  server.headersTimeout = 10000; server.requestTimeout = 15000;
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => socket.destroy());
    const websocket = req.method === 'GET' && String(req.headers.upgrade ?? '').toLowerCase() === 'websocket';
    if (!websocket || !req.url.startsWith('/') || rawPath(req.url) !== SOCKET_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      if (typeof socket.destroySoon === 'function') socket.destroySoon(); else socket.destroy();
      return;
    }
    tunnel(req, socket, head, targets.game, { timeoutMs, tunnels });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, bind, resolve); });
  return {
    server, port: server.address().port,
    close: async () => {
      const closed = new Promise(resolve => server.close(resolve));
      server.closeIdleConnections?.();
      for (const socket of tunnels) socket.destroy();
      await closed;
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createGateway({ port: +(process.env.MC_GATEWAY_PORT || 8092), bind: process.env.MC_GATEWAY_BIND || '127.0.0.1',
    profiles: process.env.MC_GATEWAY_PROFILES || undefined, game: process.env.MC_GATEWAY_GAME || undefined });
  console.log('Gateway listening on loopback port ' + app.port);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => app.close().then(() => process.exit(0)));
}
