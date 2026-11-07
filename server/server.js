import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { DedicatedSimulation } from '../src/multiplayer/simulation.js';
import { PROTOCOL, validName } from '../src/multiplayer/protocol.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_ORIGINS = ['https://jhuang165.github.io', 'http://localhost:5179', 'http://127.0.0.1:5179', 'https://ledoge0.tail92abaf.ts.net'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const equalToken = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function createDedicatedServer({ port = 8089, bind = '127.0.0.1', token, dataFile = path.join(ROOT, 'server-data/world.json'),
  origins = DEFAULT_ORIGINS, simulation = null, tickMs = 50, saveMs = 10000, staticDir = path.join(ROOT, 'dist') } = {}) {
  if (typeof token !== 'string' || token.length < 16) throw new Error('MC_WEB_TOKEN must contain at least 16 characters');
  if (!simulation) {
    let saved = {};
    try { saved = JSON.parse(await readFile(dataFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    simulation = new DedicatedSimulation(saved);
  }
  const sockets = new Map();
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
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
  const send = (ws, message) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 2 * 1024 * 1024) { ws.terminate(); return; }
    ws.send(JSON.stringify(message));
  };
  const broadcast = message => { for (const ws of sockets.values()) send(ws, message); };
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
          if (m.type !== 'join' || m.protocol !== PROTOCOL || !equalToken(m.token, token)) return ws.close(1008, 'Wrong server key or protocol');
          if (sockets.size >= 8) return ws.close(1008, 'World is full (8 players)');
          if (!validName(m.name) || typeof m.resumeKey !== 'string' || !/^[a-f0-9-]{36}$/.test(m.resumeKey)) return ws.close(1008, 'Invalid player identity');
          simulation.addPlayer(id, m.name, m.resumeKey);
          joined = true; clearTimeout(timer); sockets.set(id, ws);
          send(ws, { type: 'welcome', protocol: PROTOCOL, id, world: simulation.snapshot(), self: simulation.savePlayer(simulation.players.get(id)) });
          broadcast({ type: 'chat', name: '', text: `${m.name} joined the game` });
          return;
        }
        if (m.type === 'input') { if (!simulation.input(id, m)) ws.close(1008, 'Invalid input'); }
        else if (m.type === 'edit') simulation.queueEdit(id, m);
        else if (m.type === 'chat' && typeof m.text === 'string') {
          const text = m.text.replace(/[\x00-\x1f\x7f§]/g, '').trim().slice(0, 100);
          if (text) broadcast({ type: 'chat', name: simulation.players.get(id).name, text });
        } else ws.close(1008, 'Unknown message');
      } catch (error) { send(ws, { type: 'error', text: error.message }); ws.close(1008, 'Request rejected'); }
    });
    ws.on('close', () => {
      clearTimeout(timer);
      if (!joined) return;
      const name = simulation.players.get(id)?.name;
      simulation.removePlayer(id); sockets.delete(id);
      broadcast({ type: 'chat', name: '', text: `${name} left the game` });
    });
  });
  const tickTimer = setInterval(() => {
    try { broadcast(simulation.tick()); }
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
  }
  return { server, simulation, save, close, port: server.address().port };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), argument = (key, fallback) => { const at = args.indexOf(key); return at < 0 ? fallback : args[at + 1]; };
  const app = await createDedicatedServer({ port: Number(argument('--port', 8089)), bind: argument('--bind', '127.0.0.1'), token: process.env.MC_WEB_TOKEN,
    dataFile: argument('--data', path.join(ROOT, 'server-data/world.json')), origins: [...DEFAULT_ORIGINS, ...(process.env.MC_WEB_ORIGINS ?? '').split(',').filter(Boolean)] });
  console.log(`Dedicated world listening on ${app.server.address().address}:${app.port}`);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void app.close().then(() => process.exit(0), error => { console.error(error.message); process.exit(1); }); });
}
