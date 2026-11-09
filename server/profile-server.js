// Public accounts/skin API only: no world, WebSocket, static-files or multiplayer listener. Bind behind HTTPS on loopback.
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { AccountStore, AccountError, PROFILE_SCRYPT } from './accounts.js';
import { pngSize, MAX_SKIN_BYTES, normalizeSkinPixels } from '../src/skin.js';
import { decodePng, encodePng } from '../src/png-codec.js';

async function checkedSkin(bytes) {
  const size = pngSize(bytes);
  if (!size || size.width !== 64 || size.height !== 32) throw new AccountError(400, 'Upload a 64 × 32 PNG skin.');
  // Bound decompression before handing the PNG to the shared decoder. Reject duplicate headers and trailing data;
  // re-encode pixels so ancillary metadata and malformed checksums never become hosted user content.
  let header = false, ended = false, channels = 0;
  const idat = [];
  for (let at = 8; at + 12 <= bytes.length;) {
    const n = bytes.readUInt32BE(at), type = bytes.toString('ascii', at + 4, at + 8);
    if (at + 12 + n > bytes.length) throw new AccountError(400, 'Invalid PNG skin.');
    if (type === 'IHDR') {
      if (header || at !== 8 || n !== 13 || bytes[at + 16] !== 8 || bytes[at + 20] !== 0) throw new AccountError(400, 'Invalid PNG skin.');
      header = true; channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[bytes[at + 17]];
    }
    if (type === 'IDAT') idat.push(bytes.subarray(at + 8, at + 8 + n));
    at += n + 12;
    if (type === 'IEND') { ended = n === 0 && at === bytes.length; break; }
  }
  if (!ended || !channels || !idat.length) throw new AccountError(400, 'Invalid PNG skin.');
  try {
    const raw = inflateSync(Buffer.concat(idat), { maxOutputLength: 8224 });
    if (raw.length !== (64 * channels + 1) * 32) throw Error();
    const decoded = await decodePng(bytes);
    if (!decoded) throw Error();
    return Buffer.from(await encodePng(64, 32, normalizeSkinPixels(decoded.data, 32)));
  } catch { throw new AccountError(400, 'Invalid PNG skin.'); }
}

export async function createProfileServer({ port = 8090, bind = '127.0.0.1', file = path.join(os.homedir(), '.local/share/mc-web-profiles/state/accounts.json'),
  origins = ['https://jhuang165.github.io'], accounts = null } = {}) {
  accounts ??= await AccountStore.open(file, { openRegistration: true, requireEmail: true, passwordParams: PROFILE_SCRYPT });
  const cors = req => origins.includes(req.headers.origin) ? { 'Access-Control-Allow-Origin': req.headers.origin, Vary: 'Origin' } : { Vary: 'Origin' };
  const reply = (req, res, status, value) => {
    res.writeHead(status, { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(status === 204 ? undefined : JSON.stringify(value));
  };
  const body = (req, max) => new Promise((resolve, reject) => {
    if (+req.headers['content-length'] > max) { req.resume(); reject(new AccountError(413, 'Request too large.')); return; }
    const chunks = []; let length = 0, oversized = false;
    req.on('data', data => { length += data.length; if (length > max) { oversized = true; chunks.length = 0; } else if (!oversized) chunks.push(data); });
    req.on('end', () => oversized ? reject(new AccountError(413, 'Request too large.')) : resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
  const json = async req => {
    if ((req.headers['content-type'] ?? '').split(';')[0] !== 'application/json') throw new AccountError(415, 'Send JSON.');
    const bytes = await body(req, 4096);
    try { const value = JSON.parse(bytes); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch {}
    throw new AccountError(400, 'Send a JSON object.');
  };
  const bearer = req => /^Bearer ([A-Za-z0-9_-]{1,100})$/.exec(req.headers.authorization ?? '')?.[1];
  const signedIn = req => { const account = accounts.authenticate(bearer(req)); if (!account) throw new AccountError(401, 'Sign in to continue.'); return account; };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.headers.origin && !origins.includes(req.headers.origin)) return reply(req, res, 403, { error: 'Origin not allowed.' });
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { ...cors(req), 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' }); return res.end();
      }
      const route = req.method + ' ' + url.pathname;
      if (route === 'GET /health') return reply(req, res, 200, { service: 'mc-web-profiles', status: 'ok' });
      if (route === 'POST /api/register') {
        const data = await accounts.register(await json(req));
        return reply(req, res, 201, { ...data, account: accounts.self(accounts.authenticate(data.session)) });
      }
      if (route === 'POST /api/login') {
        const data = await accounts.login(await json(req));
        return reply(req, res, 200, { ...data, account: accounts.self(accounts.authenticate(data.session)) });
      }
      if (route === 'POST /api/logout') { await accounts.logout(bearer(req)); return reply(req, res, 204); }
      if (route === 'GET /api/me') return reply(req, res, 200, { account: accounts.self(signedIn(req)) });
      if (route === 'PATCH /api/me') {
        const account = signedIn(req); await accounts.rename(account, (await json(req)).name);
        return reply(req, res, 200, { account: accounts.self(account) });
      }
      if (route === 'PUT /api/skin') {
        const account = signedIn(req);
        if (req.headers['content-type'] !== 'image/png') throw new AccountError(415, 'Upload a PNG image.');
        await accounts.setSkin(account, await checkedSkin(await body(req, MAX_SKIN_BYTES)));
        return reply(req, res, 200, { account: accounts.self(account) });
      }
      if (route === 'DELETE /api/skin') { const account = signedIn(req); await accounts.clearSkin(account); return reply(req, res, 200, { account: accounts.self(account) }); }
      const skin = /^\/api\/skins\/([a-f0-9]{20})\.png$/.exec(url.pathname);
      if (skin && (req.method === 'GET' || req.method === 'HEAD')) {
        const png = accounts.skins.get(skin[1]);
        if (!png) return reply(req, res, 404, { error: 'Skin not found.' });
        res.writeHead(200, { ...cors(req), 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable' });
        return res.end(req.method === 'HEAD' ? undefined : png);
      }
      return reply(req, res, 404, { error: 'Not found.' });
    } catch (error) { reply(req, res, error instanceof AccountError ? error.status : 500, { error: error instanceof AccountError ? error.message : 'Account service error.' }); }
  });
  server.headersTimeout = 10000; server.requestTimeout = 15000;
  server.on('upgrade', (_req, socket) => socket.destroy());
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, bind, resolve); });
  return { server, accounts, port: server.address().port, close: async () => { await new Promise(resolve => server.close(resolve)); await accounts.saving; } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createProfileServer({ port: +(process.env.MC_PROFILE_PORT ?? 8090), file: process.env.MC_PROFILE_ACCOUNTS,
    origins: (process.env.MC_PROFILE_ORIGINS ?? 'https://jhuang165.github.io').split(',') });
  console.log('Account service listening on loopback port ' + app.port);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => app.close().then(() => process.exit(0)));
}
