import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { DedicatedSimulation } from '../src/multiplayer/simulation.js';
import { PROTOCOL, expandChunks } from '../src/multiplayer/protocol.js';
import { AccountStore, AccountError } from './accounts.js';
import { MAX_SKIN_BYTES } from '../src/skin.js';
import { SpamCounter, chatPacket } from '../src/server-handlers.js';
import { ServerSocial } from '../src/server-broadcast.js';
import { installServerRules } from '../src/servercommands-b59.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_ORIGINS = ['https://jhuang165.github.io', 'http://localhost:5179', 'http://127.0.0.1:5179', 'https://ledoge0.tail92abaf.ts.net'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const equalToken = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// `token` is the owner's private server key. It no longer admits players: it
// creates admin accounts and invites. Players join with an account session.
export async function createDedicatedServer({ port = 8089, bind = '127.0.0.1', token, dataFile = path.join(ROOT, 'server-data/world.json'),
  accountsFile = path.join(path.dirname(dataFile), 'accounts.json'), accounts = null,
  origins = DEFAULT_ORIGINS, gameMode = 'creative', difficulty = 2, ops = [], simulation = null, tickMs = 50, saveMs = 10000, staticDir = path.join(ROOT, 'dist') } = {}) {
  if (typeof token !== 'string' || token.length < 16) throw new Error('MC_WEB_TOKEN must contain at least 16 characters');
  accounts ??= await AccountStore.open(accountsFile);
  if (!simulation) {
    let saved = {};
    try { saved = JSON.parse(await readFile(dataFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    simulation = new DedicatedSimulation(saved, { gameMode, difficulty });
  }
  const sockets = new Map(), owners = new Map(); // player id → socket, player id → account id
  let closing = false, saving = Promise.resolve(), saveError = null;
  const save = () => {
    // Serialize in tick order; atomic rename never truncates the last good save.
    const data = JSON.stringify(simulation.save());
    saving = saving.catch(() => {}).then(async () => {
      await mkdir(path.dirname(dataFile), { recursive: true, mode: 0o700 });
      await writeFile(dataFile + '.tmp', data, { mode: 0o600 });
      await rename(dataFile + '.tmp', dataFile);
      saveError = null;
    }).catch(error => { saveError = error; console.error('World save failed:', error.message); throw error; });
    return saving;
  };
  const server = http.createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { res.writeHead(400); return res.end(); }
    if (url.pathname.startsWith('/api/')) return api(req, res, url).catch(error => {
      const status = error instanceof AccountError ? error.status : 500;
      if (status === 500) console.error('Account request failed:', error.message);
      if (!res.headersSent) json(res, status, { error: status === 500 ? 'Server error' : error.message }, req);
      else res.end();
    });
    if (url.pathname === '/health') {
      res.writeHead(saveError ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ protocol: PROTOCOL, tick: simulation.ticks, players: sockets.size, saving: !saveError }));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    if (url.pathname === '/') { res.writeHead(302, { Location: '/mc-web/' }); return res.end(); }
    if (!url.pathname.startsWith('/mc-web/')) { res.writeHead(404); return res.end(); }
    try {
      const relative = decodeURIComponent(url.pathname.slice('/mc-web/'.length)) || 'index.html';
      const file = path.resolve(staticDir, relative);
      if (!file.startsWith(path.resolve(staticDir) + path.sep) || !(await stat(file)).isFile()) throw new Error('Not found');
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  const cors = req => {
    const origin = req.headers.origin;
    return origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Private-Network': 'true' } : { Vary: 'Origin' };
  };
  const json = (res, status, body, req) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors(req), ...(status === 413 ? { Connection: 'close' } : {}) });
    res.end(status === 204 ? undefined : JSON.stringify(body));
  };
  const body = (req, limit) => new Promise((resolve, reject) => {
    // A declared oversized body is refused before reading, so the client still gets the 413.
    if (Number(req.headers['content-length']) > limit) return reject(new AccountError(413, 'Request too large.'));
    const chunks = []; let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > limit) { reject(new AccountError(413, 'Request too large.')); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
  const jsonBody = async req => {
    try { const value = JSON.parse((await body(req, 4096)).toString('utf8')); if (value && typeof value === 'object') return value; } catch (error) { if (error instanceof AccountError) throw error; }
    throw new AccountError(400, 'Send a JSON object.');
  };
  const bearer = req => /^Bearer (\S{1,200})$/.exec(req.headers.authorization ?? '')?.[1] ?? null;
  const signedIn = req => { const a = accounts.authenticate(bearer(req)); if (!a) throw new AccountError(401, 'Sign in again.'); return a; };
  // Renames and skin changes reach connected players on the next presence tick.
  const refresh = account => { for (const [id, owner] of owners) if (owner === account.id) Object.assign(simulation.players.get(id) ?? {}, { name: account.name, skin: account.skinHash }); };
  async function api(req, res, url) {
    // Browsers send Origin; a request from a page outside the allowlist is refused.
    // Command-line clients (no Origin) still need a session or the server key.
    if (req.headers.origin && !origins.includes(req.headers.origin)) return json(res, 403, { error: 'Origin not allowed' }, req);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...cors(req), 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' });
      return res.end();
    }
    const route = `${req.method} ${url.pathname}`;
    const skin = /^\/api\/skins\/([a-f0-9]{20})\.png$/.exec(url.pathname);
    if (skin && (req.method === 'GET' || req.method === 'HEAD')) {
      const png = accounts.skins.get(skin[1]);
      if (!png) return json(res, 404, { error: 'No such skin' }, req);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', ...cors(req) });
      return res.end(req.method === 'HEAD' ? undefined : png);
    }
    if (route === 'POST /api/register') { const m = await jsonBody(req); return json(res, 201, await accounts.register(m, token), req); }
    if (route === 'POST /api/login') { const m = await jsonBody(req); return json(res, 200, await accounts.login(m), req); }
    if (route === 'POST /api/logout') { await accounts.logout(bearer(req)); return json(res, 204, null, req); }
    if (route === 'GET /api/me') return json(res, 200, { account: accounts.public(signedIn(req)) }, req);
    if (route === 'PATCH /api/me') {
      const account = signedIn(req), m = await jsonBody(req);
      const out = await accounts.rename(account, m.name); refresh(account);
      return json(res, 200, { account: out }, req);
    }
    if (route === 'PUT /api/skin') {
      const account = signedIn(req);
      if (req.headers['content-type'] !== 'image/png') throw new AccountError(415, 'Upload a PNG image.');
      const out = await accounts.setSkin(account, await body(req, MAX_SKIN_BYTES)); refresh(account);
      return json(res, 200, { account: out }, req);
    }
    if (route === 'DELETE /api/skin') { const account = signedIn(req); const out = await accounts.clearSkin(account); refresh(account); return json(res, 200, { account: out }, req); }
    if (route === 'POST /api/invites') {
      const key = bearer(req), owner = equalToken(key, token), account = owner ? null : accounts.authenticate(key);
      if (!owner && !account) throw new AccountError(401, 'Sign in again.');
      if (!owner && !account.admin) throw new AccountError(403, 'Only admins can create invites.');
      return json(res, 201, await accounts.createInvite(owner ? 'owner' : account.id), req);
    }
    return json(res, 404, { error: 'Unknown request' }, req);
  }
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32768, perMessageDeflate: false });
  const send = (ws, message) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 2 * 1024 * 1024) { ws.terminate(); return; }
    ws.send(JSON.stringify(message));
  };
  // Whole-chunk resends (`chunks`) go only to clients that joined with `chunks: true`; the others get the same cells as `changes`.
  const broadcast = message => { let plain; for (const ws of sockets.values()) send(ws, ws.chunks || !message.chunks ? message : (plain ??= expandChunks(message))); };
  // Chat, commands, death and achievement broadcasts (src/server-broadcast.js); `ops` names the players who may run commands.
  installServerRules(simulation); // /gamerule values reach the fire, griefing and tick readers of this process
  const social = new ServerSocial({ simulation, ops, deliver: (pid, message) => { const ws = sockets.get(pid); if (ws) send(ws, message); } });
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => {});
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { socket.destroy(); return; }
    if (closing || pathname !== '/multiplayer' || !origins.includes(req.headers.origin) || wss.clients.size >= 12) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  wss.on('connection', ws => {
    const id = randomUUID();
    const chatSpam = new SpamCounter(); // NetHandlerPlayServer.l, one per connection, decays 1 per 50 ms game tick
    let joined = false, budget = 80, budgetAt = Date.now(), alive = true;
    const timer = setTimeout(() => ws.close(1008, 'Join timed out'), 10000);
    ws.on('error', () => {});
    ws.on('pong', () => { alive = true; });
    ws.heartbeat = () => { if (!alive) return ws.terminate(); alive = false; ws.ping(); };
    ws.on('message', (data, binary) => {
      try {
        const now = Date.now();
        budget = Math.min(80, budget + (now - budgetAt) * .06); budgetAt = now;
        if (--budget < 0 || binary) return ws.close(1008, 'Message rate or format rejected');
        const m = JSON.parse(data.toString());
        if (!m || typeof m !== 'object') return ws.close(1008, 'Invalid message');
        if (!joined) {
          if (m.type !== 'join' || m.protocol !== PROTOCOL) return ws.close(1008, 'This game version differs from the server. Reload the page.');
          const account = accounts.authenticate(m.session);
          if (!account) return ws.close(1008, 'Sign in again.');
          // NetHandlerLoginServer: a second login replaces the first connection.
          const previous = [...owners].find(([, owner]) => owner === account.id)?.[0];
          if (previous === undefined && sockets.size >= 8) return ws.close(1008, 'World is full (8 players)');
          if (previous !== undefined) {
            const old = sockets.get(previous);
            social.forget(previous); simulation.removePlayer(previous); sockets.delete(previous); owners.delete(previous);
            old.replaced = true; old.close(1008, 'You logged in from another location');
          }
          simulation.addPlayer(id, account.name, account.id, { skin: account.skinHash });
          joined = true; ws.chunks = m.chunks === true; clearTimeout(timer); sockets.set(id, ws); owners.set(id, account.id);
          send(ws, { type: 'welcome', protocol: PROTOCOL, id, world: simulation.snapshot(), self: simulation.savePlayer(simulation.players.get(id)) });
          if (previous === undefined) broadcast({ type: 'chat', name: '', text: `${account.name} joined the game` });
          return;
        }
        if (m.type === 'input') { if (!simulation.input(id, m)) ws.close(1008, 'Invalid input'); }
        else if (m.type === 'edit') simulation.queueEdit(id, m);
        else if (m.type === 'dig' && Number.isInteger(m.status)) simulation.queueDig(id, m.status); // C07 status 0 start / 1 abort / 2 finish, through the server's dig timer
        else if (m.type === 'pickup' && Array.isArray(m.ids)) simulation.pickup(id, m.ids, m.fit); // item entities the client reaches (Survival)
        else if (m.type === 'use' && typeof m.active === 'boolean') simulation.queueUse(id, m.active); // right button down / up: EntityPlayer.setItemInUse
        else if (m.type === 'respawn') simulation.serverSurvival.respawn(simulation.players.get(id)); // C16 client status 0, perform respawn
        else if (m.type === 'attack' && Number.isInteger(m.mob)) simulation.queueAttack(id, m.mob); // C02 UseEntity (attack) on a mob, the wire id of its S0F spawn
        else if (m.type === 'sign') simulation.updateSign(id, m); // C12 update sign
        else if (m.type === 'beacon') simulation.chooseBeacon(id, m); // MC|Beacon
        else if (m.type === 'beaconPayment') simulation.setBeaconPayment(id, m); // click on the beacon window's payment slot
        else if (m.type === 'achDrop') simulation.dropHeld(id, m.all === true); // b60: Q / Ctrl+Q, the item entity carries the thrower
        else if (m.type === 'openInventory') social.openInventory(id); // C16 status 2: Taking Inventory
        else if (m.type === 'invClick') simulation.invClick(id, m); // b60: C0E window 0 (the player's inventory)
        else if (m.type === 'invAck') simulation.invAck(id); // b60: C0F window 0
        else if (m.type === 'invClose') simulation.invClose(id); // b60: C0D window 0
        else if (m.type === 'closeWindow') simulation.closeWindow(id); // C0D
        else if (m.type === 'clickWindow') simulation.clickWindow(id, m); // C0E
        else if (m.type === 'windowInventory') simulation.windowInventory(id, m); // the client's 36 slots after S2D
        else if (m.type === 'stationEnchant' || m.type === 'stationItemName') simulation.station(id, m); // b60: C11 EnchantItem, MC|ItemName
        else if (m.type === 'confirmTransaction') simulation.confirmTransaction(id, m); // C0F
        else if (m.type === 'chat' && typeof m.text === 'string') {
          // NetHandlerPlayServer chat: 100 character cut, whitespace collapse, illegal characters and spam (> 200, +20 per message) kick.
          // The dedicated server has no operators, so nobody is exempt.
          const r = chatPacket(chatSpam, Math.floor(Date.now() / 50), m.text, false);
          if (r.deliver && r.deliver.startsWith('/')) social.command(id, r.deliver); // /tell, /me; operators also /give, /tp, /gamemode ... on named players
          else if (r.deliver) social.chat(id, r.deliver);
          if (r.kick) return ws.close(1008, r.kick);
        } else ws.close(1008, 'Unknown message');
      } catch (error) { send(ws, { type: 'error', text: error.message }); ws.close(1008, 'Request rejected'); }
    });
    ws.on('close', () => {
      clearTimeout(timer);
      if (!joined || ws.replaced) return;
      const name = simulation.players.get(id)?.name;
      social.forget(id); simulation.removePlayer(id); sockets.delete(id); owners.delete(id);
      broadcast({ type: 'chat', name: '', text: `${name} left the game` });
    });
  });
  const tickTimer = setInterval(() => {
    try {
      broadcast(simulation.tick());
      social.drain(); // death messages queued by the tick, to every player
      // C08 build-height refusal text goes to that player only (NetHandlerPlayServer sends a chat packet to the clicker).
      // The two S23 resends of a block placement packet go to the clicker only, after the refusal text.
      for (const [pid, player] of simulation.players) {
        const ws = sockets.get(pid);
        if (player.refusal && ws) send(ws, { type: 'chat', name: '', text: player.refusal });
        if (player.blocks && ws) send(ws, { type: 'blocks', changes: player.blocks });
        if (player.openSign && ws) send(ws, { type: 'signEditor', x: player.openSign[0], y: player.openSign[1], z: player.openSign[2] }); // S36 open sign editor
        if (player.openBeacon && ws) { // S2D open window for ContainerBeacon, with the tile's levels, effects and payment slot
          const t = simulation.tileEntities.beacons.get(...player.openBeacon);
          send(ws, { type: 'beaconWindow', x: player.openBeacon[0], y: player.openBeacon[1], z: player.openBeacon[2], levels: t.levels, primary: t.primary, secondary: t.secondary, payment: t.payment ? { id: t.payment.id, damage: t.payment.damage ?? 0 } : null });
        }
        for (const w of player.windowOut ?? []) if (ws) send(ws, w); // S2D / S30 / S2F / S32 / S31 / S2E
        player.windowOut = null;
        if (player.cracksOut && ws) send(ws, { type: 'crack', cracks: player.cracksOut }); // S25 block break animation of the other players (range 32)
        for (const stack of player.collectedOut ?? []) if (ws) send(ws, { type: 'collect', stack }); // items picked up, added to the client's inventory
        if (player.soundsOut && ws) send(ws, { type: 'sound', sounds: player.soundsOut }); // S29 random.eat / random.drink / random.burp of other players (range 16)
        for (const m of simulation.serverSurvival.outgoing(player)) if (ws) send(ws, m); // b60: S19 hurt / death, S1D / S1E effects (healthHurt, healthEffect, healthEffectEnd)
        const vitals = simulation.serverSurvival.status(player); if (vitals && ws) send(ws, vitals); // S06 update health (health, food, saturation) when one changed
        for (const m of player.itemsOut ?? []) if (ws) send(ws, m); // b59: S2F slot corrections, S28 break effects, XP gains (server-items.js)
        for (const e of player.effectsOut ?? []) if (ws) send(ws, { type: 'effect', ...e }); // S1D entity effect (beacon grants)
        if (player.mobPackets && ws) send(ws, { type: 'mobs', packets: player.mobPackets }); // S0F / S14..S19 / S13 of the mobs this player tracks (server-mobs.js)
        player.refusal = null; player.blocks = null; player.openSign = null; player.openBeacon = null; player.effectsOut = null; player.cracksOut = null; player.collectedOut = null; player.soundsOut = null; player.itemsOut = null; player.mobPackets = null;
      }
    }
    catch (error) { console.error('Dedicated tick failed:', error.stack); void close().catch(error => console.error(error.message)).finally(() => { process.exitCode = 1; }); }
  }, tickMs);
  const saveTimer = setInterval(() => { void save().catch(() => {}); }, saveMs);
  const heartbeatTimer = setInterval(() => { for (const ws of wss.clients) ws.heartbeat(); }, 10000);
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, bind, resolve); }); }
  catch (error) { clearInterval(tickTimer); clearInterval(saveTimer); clearInterval(heartbeatTimer); wss.close(); throw error; }
  async function close() {
    if (closing) return;
    closing = true;
    clearInterval(tickTimer); clearInterval(saveTimer); clearInterval(heartbeatTimer);
    for (const ws of wss.clients) ws.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
    await save();
    await accounts.save();
  }
  return { server, simulation, accounts, save, close, port: server.address().port };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), argument = (key, fallback) => { const at = args.indexOf(key); return at < 0 ? fallback : args[at + 1]; };
  const app = await createDedicatedServer({ port: Number(argument('--port', 8089)), bind: argument('--bind', '127.0.0.1'), token: process.env.MC_WEB_TOKEN,
    gameMode: argument('--gamemode', 'creative'), difficulty: Number(argument('--difficulty', 2)), dataFile: argument('--data', path.join(ROOT, 'server-data/world.json')), ops: (process.env.MC_WEB_OPS ?? '').split(',').filter(Boolean), origins: [...DEFAULT_ORIGINS, ...(process.env.MC_WEB_ORIGINS ?? '').split(',').filter(Boolean)] });
  console.log(`Dedicated world listening on ${app.server.address().address}:${app.port}`);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void app.close().then(() => process.exit(0), error => { console.error(error.message); process.exit(1); }); });
}
