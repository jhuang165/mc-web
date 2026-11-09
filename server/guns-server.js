// The ledoge0 gun-pack server (protocol v3): one GunSimulation world on loopback behind the gateway (gateway.js). Players sign in
// with their website profile session, which is checked with the profile service and never stored or logged. The account
// database stays with profile-server.js; this process keeps only world and per-account player state, and the Java-style
// server.properties / whitelist.json / ops.json / banned-players.json in its state directory (properties.js).
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GunSimulation } from '../src/multiplayer/gun-simulation.js';
import { PROTOCOL } from '../src/multiplayer/protocol.js';
import { loadServerFiles, formatReport } from './properties.js';
import { ProfileVerifier, ProfileUnavailable } from './profile-verifier.js';
import { installGunRules } from './pack-loader.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_ORIGINS = ['https://jhuang165.github.io', 'http://localhost:5179', 'http://127.0.0.1:5179', 'https://ledoge0.tail92abaf.ts.net'];
export const MESSAGES = {
  version: 'This game version differs from the server. Reload the page.',
  pack: 'Weapon packs differ from the server. Reload the page.',
  signIn: 'Sign in again.',
  unavailable: 'The account service is unavailable. Try again shortly.',
  whitelist: 'You are not white-listed on this server!',
  full: 'The server is full!',
  idle: 'You have been idle for too long!',
  replaced: 'You logged in from another location',
  kicked: 'Kicked by an operator.',
};
const REVALIDATE_MS = 60000, UNAVAILABLE_KICK_MS = 600000;
const reason = text => { let s = String(text); while (Buffer.byteLength(s) > 123) s = s.slice(0, -1); return s; }; // WebSocket close reasons
const cleanText = text => String(text).replace(/[\x00-\x1f\x7f§]/g, '').trim().slice(0, 100);

export function buildId(root = ROOT) {
  if (process.env.MC_GUNS_BUILD) return process.env.MC_GUNS_BUILD;
  try { return readFileSync(path.join(root, 'BUILD'), 'utf8').trim() || 'dev'; } catch {}
  try { return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'; } catch {}
  return 'dev';
}
const banText = ban => `You are banned from this server.\nReason: ${ban.reason}${ban.expires ? `\nYour ban will be removed on ${new Date(ban.expires).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}`;

// configDir (default: stateDir) holds server.properties and the admin lists; stateDir holds `<level-name>.json`.
// build 'any' accepts every client build.
export async function createGunsServer({ port = 8091, bind = '127.0.0.1', stateDir = path.join(ROOT, 'guns-data'), configDir = stateDir, packDir = path.join(ROOT, 'public/mods'),
  profiles = 'http://127.0.0.1:8090', verifier = null, origins = DEFAULT_ORIGINS, build = buildId(), tickMs = 50, saveMs = 30000,
  rules = null, simulation = null, now = () => Date.now(), log = console.log, writeDefaults = true } = {}) {
  const { config, report, admin } = await loadServerFiles(configDir, { writeDefaults, now });
  for (const line of formatReport(report)) log(`[config] ${line}`);
  rules ??= await installGunRules({ packDir });
  if (!rules.installed) log('[packs] No gun pack found; only the built-in guns are available.');
  verifier ??= new ProfileVerifier({ base: profiles });
  const dataFile = path.join(stateDir, `${config.levelName}.json`);
  if (!simulation) {
    let saved = {};
    try { saved = JSON.parse(await readFile(dataFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    simulation = new GunSimulation(saved, { config });
  }
  simulation.isOp = p => admin.opLevel(p.account) > 0;
  const sessions = new Map(); // player id -> { ws, account, name, session, checkedAt, unavailableSince }
  let closing = false, saving = Promise.resolve(), saveError = null;
  const save = () => {
    const data = JSON.stringify(simulation.save());
    saving = saving.catch(() => {}).then(async () => {
      await mkdir(stateDir, { recursive: true, mode: 0o700 });
      await writeFile(dataFile + '.tmp', data, { mode: 0o600 });
      await rename(dataFile + '.tmp', dataFile);
      saveError = null;
    }).catch(error => { saveError = error; log(`World save failed: ${error.message}`); throw error; });
    return saving;
  };
  const status = () => ({ protocol: PROTOCOL, build, pack: rules.pack, players: sessions.size, maxPlayers: config.maxPlayers, motd: config.motd, tick: simulation.ticks, saving: !saveError });
  const server = http.createServer((req, res) => {
    const pathname = (req.url ?? '').split('?')[0];
    if (pathname === '/status' && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(saveError ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        ...(origins.includes(req.headers.origin) ? { 'Access-Control-Allow-Origin': req.headers.origin, Vary: 'Origin' } : { Vary: 'Origin' }) });
      return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(status()));
    }
    res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"Not found."}');
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    const pathname = (req.url ?? '').split('?')[0];
    if (closing || pathname !== '/multiplayer' || !origins.includes(req.headers.origin) || wss.clients.size >= config.maxPlayers + 4) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  const send = (ws, m) => { if (ws.readyState === 1 && ws.bufferedAmount < 1 << 20) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
  const broadcast = m => { const text = JSON.stringify(m); for (const s of sessions.values()) send(s.ws, text); };
  const system = text => broadcast({ type: 'chat', name: '', text });
  const tell = (id, text) => { const s = sessions.get(id); if (s) send(s.ws, { type: 'chat', name: '', text }); };
  const kick = (id, text) => { const s = sessions.get(id); if (s) s.ws.close(1008, reason(text)); };
  const byName = name => [...sessions.entries()].find(([, s]) => s.name.toLowerCase() === String(name).toLowerCase());
  const level = id => admin.opLevel(sessions.get(id)?.account) ?? 0;

  async function join(ws, m) {
    if (m.type !== 'join' || m.protocol !== PROTOCOL || (build !== 'any' && m.build !== build)) return ws.close(1008, MESSAGES.version);
    if (m.pack !== rules.pack) return ws.close(1008, MESSAGES.pack);
    let profile;
    try { profile = await verifier.verify(m.session); }
    catch (error) { if (error instanceof ProfileUnavailable) return ws.close(1013, MESSAGES.unavailable); throw error; }
    if (ws.readyState !== 1 || closing) return;
    if (!profile) return ws.close(1008, MESSAGES.signIn);
    const ban = admin.ban(profile.id);
    if (ban) return ws.close(1008, reason(banText(ban)));
    const op = admin.lists.ops.get(admin.resolve(profile.id));
    if (config.whitelist && !admin.whitelisted(profile.id) && !op) return ws.close(1008, MESSAGES.whitelist);
    const previous = [...sessions.entries()].find(([, s]) => s.account === profile.id);
    if (!previous && sessions.size >= config.maxPlayers && !op?.bypassesPlayerLimit) return ws.close(1008, MESSAGES.full);
    if (previous) {
      const [oldId, old] = previous;
      old.replaced = true; sessions.delete(oldId); simulation.removePlayer(oldId); old.ws.close(1008, MESSAGES.replaced);
    }
    const id = randomUUID();
    // A website rename could collide with a connected player's old name; the account ID stays the key either way.
    if (byName(profile.name)) return ws.close(1008, MESSAGES.replaced);
    simulation.addPlayer(id, profile.name, profile.id, { skin: profile.skin });
    sessions.set(id, { ws, account: profile.id, name: profile.name, session: m.session, checkedAt: now(), unavailableSince: null });
    ws.playerId = id;
    const p = simulation.players.get(id);
    send(ws, { type: 'welcome', protocol: PROTOCOL, build, pack: rules.pack, id, world: simulation.snapshot(), self: simulation.savePlayer(p),
      you: simulation.you(p), motd: config.motd, pvp: config.pvp !== false, op: level(id) });
    if (!previous) system(`${profile.name} joined the game`);
    log(`[join] ${profile.name} (${profile.id})`);
  }

  wss.on('connection', ws => {
    let budget = 120, budgetAt = Date.now(), alive = true, joining = false;
    const timer = setTimeout(() => { if (!ws.playerId) ws.close(1008, 'Join timed out'); }, 10000);
    ws.on('pong', () => { alive = true; });
    ws.heartbeat = () => { if (!alive) return ws.terminate(); alive = false; ws.ping(); };
    ws.on('message', (data, binary) => {
      try {
        const t = Date.now();
        budget = Math.min(120, budget + (t - budgetAt) * .1); budgetAt = t;
        if (--budget < 0 || binary) return ws.close(1008, 'Message rate or format rejected');
        const m = JSON.parse(data.toString());
        if (!m || typeof m !== 'object') return ws.close(1008, 'Invalid message');
        const id = ws.playerId;
        if (!id) {
          if (joining) return ws.close(1008, 'Invalid message');
          joining = true;
          return void join(ws, m).catch(error => { log(`Join failed: ${error.message}`); ws.close(1011, 'Server error'); }).finally(() => { joining = false; clearTimeout(timer); });
        }
        if (m.type === 'input') { if (!simulation.input(id, m)) ws.close(1008, 'Invalid input'); }
        else if (m.type === 'action') { if (!simulation.action(id, m)) ws.close(1008, 'Invalid action'); }
        else if (m.type === 'edit') simulation.queueEdit(id, m);
        else if (m.type === 'respawn') simulation.respawn(id);
        else if (m.type === 'chat' && typeof m.text === 'string') {
          const text = cleanText(m.text);
          if (text.startsWith('/')) command(id, text.slice(1));
          else if (text) broadcast({ type: 'chat', name: sessions.get(id).name, text });
        } else ws.close(1008, 'Unknown message');
      } catch (error) { send(ws, { type: 'error', text: 'Request rejected' }); ws.close(1008, 'Request rejected'); }
    });
    ws.on('close', () => {
      clearTimeout(timer);
      const id = ws.playerId;
      if (!id || ws.replaced || !sessions.has(id)) return;
      const name = sessions.get(id).name;
      sessions.delete(id); simulation.removePlayer(id);
      system(`${name} left the game`);
    });
  });

  // Vanilla-style commands. Levels follow ops.json: 1 bypass spawn protection, 2 cheats, 3 player management, 4 server.
  const COMMANDS = {
    help: [0, () => 'Commands: list, kill, help; ops: gamemode, kit, kick, ban, pardon, whitelist, op, deop, save-all'],
    list: [0, () => `There are ${sessions.size}/${config.maxPlayers} players online: ${[...sessions.values()].map(s => s.name).join(', ')}`],
    kill: [0, id => { const p = simulation.players.get(id); if (p && !p.dead) { p.survival.health = 0; p.lastHit = null; } return null; }],
    gamemode: [2, (id, [mode, target]) => {
      const name = /^\d$/.test(mode ?? '') ? ['survival', 'creative', 'adventure'][+mode] : { s: 'survival', c: 'creative', a: 'adventure' }[mode] ?? mode;
      const m = ['survival', 'creative', 'adventure'].includes(name) ? name : null;
      if (!m) return 'Usage: /gamemode <survival|creative|adventure> [player]';
      const entry = target ? byName(target) : [id, sessions.get(id)];
      if (!entry) return `Player ${target} not found`;
      simulation.setMode(simulation.players.get(entry[0]), m);
      return `Set ${entry[1].name}'s game mode to ${m}`;
    }],
    kit: [2, (id, [target]) => {
      const entry = target ? byName(target) : [id, sessions.get(id)];
      if (!entry) return `Player ${target} not found`;
      simulation.giveKit(simulation.players.get(entry[0]));
      return `Gave the arena kit to ${entry[1].name}`;
    }],
    kick: [3, (id, [name, ...words]) => {
      const entry = name && byName(name);
      if (!entry) return 'Usage: /kick <player> [reason]';
      kick(entry[0], words.join(' ') || MESSAGES.kicked);
      return `Kicked ${entry[1].name}`;
    }],
    ban: [3, (id, [name, ...words]) => {
      const entry = name && byName(name);
      if (!entry) return 'Usage: /ban <online player> [reason]';
      const ban = admin.addBan({ id: entry[1].account, name: entry[1].name }, { reason: words.join(' ') || 'Banned by an operator.', source: sessions.get(id).name });
      void admin.save().catch(error => log(`Admin save failed: ${error.message}`));
      kick(entry[0], banText(ban));
      return `Banned ${entry[1].name}`;
    }],
    pardon: [3, (id, [name]) => { if (!name || !admin.pardon(name)) return `Could not unban ${name ?? ''}`.trim(); void admin.save(); return `Unbanned ${name}`; }],
    whitelist: [3, async (id, [sub, name]) => {
      if (sub === 'on' || sub === 'off') { config.whitelist = sub === 'on'; if (config.whitelist) enforce(); return `Turned ${sub} the whitelist`; }
      if (sub === 'list') { const list = admin.whitelistEntries().map(e => e.name); return `There are ${list.length} whitelisted players: ${list.join(', ')}`; }
      if (sub === 'reload') { await admin.load(); enforce(); return 'Reloaded the whitelist'; }
      if (sub === 'add') {
        const entry = name && byName(name);
        if (!entry) return 'Players must be online to be added by name; add offline accounts to whitelist.json by account ID.';
        admin.addWhitelist({ id: entry[1].account, name: entry[1].name }); await admin.save(); return `Added ${entry[1].name} to the whitelist`;
      }
      if (sub === 'remove') { if (!name || !admin.removeWhitelist(name)) return `Could not remove ${name ?? ''}`.trim(); await admin.save(); enforce(); return `Removed ${name} from the whitelist`; }
      return 'Usage: /whitelist <on|off|list|add|remove|reload>';
    }],
    op: [3, async (id, [name]) => {
      const entry = name && byName(name);
      if (!entry) return 'Usage: /op <online player>';
      admin.addOp({ id: entry[1].account, name: entry[1].name }); await admin.save();
      tell(entry[0], 'You are now an operator'); return `Opped ${entry[1].name}`;
    }],
    deop: [3, async (id, [name]) => { if (!name || !admin.removeOp(name)) return `Could not de-op ${name ?? ''}`.trim(); await admin.save(); return `De-opped ${name}`; }],
    'save-all': [4, async () => { await save(); return 'Saved the world'; }],
  };
  function enforce() {
    if (!config.whitelist || !config.enforceWhitelist) return;
    for (const [id, s] of sessions) if (!admin.whitelisted(s.account) && !admin.opLevel(s.account)) kick(id, MESSAGES.whitelist);
  }
  function command(id, text) {
    const [name, ...args] = text.split(/\s+/).filter(Boolean), entry = COMMANDS[name?.toLowerCase()];
    if (!entry) return tell(id, 'Unknown command. Try /help for a list of commands');
    if (level(id) < entry[0]) return tell(id, 'You do not have permission to use this command');
    Promise.resolve(entry[1](id, args)).then(out => { if (out) tell(id, out); }, error => tell(id, `An error occurred: ${error.message}`));
    if (entry[0] >= 2) log(`[command] ${sessions.get(id)?.name}: /${name} ${args.join(' ')}`.trim());
  }

  // Revalidate each session with the profile service once a minute: a logout or deleted account kicks; a rename or new skin updates.
  async function revalidate() {
    for (const [id, s] of [...sessions]) {
      if (now() - s.checkedAt < REVALIDATE_MS) continue;
      s.checkedAt = now();
      try {
        const profile = await verifier.verify(s.session);
        s.unavailableSince = null;
        if (!sessions.has(id)) continue;
        if (!profile || profile.id !== s.account) { kick(id, MESSAGES.signIn); continue; }
        const p = simulation.players.get(id);
        if (p && profile.skin !== p.skin) p.skin = profile.skin;
        if (p && profile.name !== s.name && !byName(profile.name)) { system(`${s.name} is now known as ${profile.name}`); s.name = p.name = profile.name; }
      } catch {
        s.unavailableSince ??= now();
        if (now() - s.unavailableSince > UNAVAILABLE_KICK_MS) kick(id, MESSAGES.unavailable);
      }
    }
  }

  function tick() {
    const base = simulation.tick();
    for (const text of simulation.chatOut.splice(0)) system(text); // death messages, sent as chat before the tick that shows them
    const common = JSON.stringify(base).slice(0, -1); // the shared part, closed per player with `you` and `events`
    for (const [id, s] of sessions) {
      const p = simulation.players.get(id);
      if (!p) continue;
      send(s.ws, `${common},"you":${JSON.stringify(simulation.you(p))},"events":${JSON.stringify(simulation.drainEvents(p))}}`);
      if (config.idleTimeout > 0 && simulation.ticks - p.idleSince > config.idleTimeout * 1200) kick(id, MESSAGES.idle);
    }
  }
  const tickTimer = setInterval(() => {
    try { tick(); }
    catch (error) { log(`Gun server tick failed: ${error.stack}`); void close().catch(() => {}).finally(() => { process.exitCode = 1; }); }
  }, tickMs);
  const saveTimer = setInterval(() => { void save().catch(() => {}); }, saveMs);
  const heartbeatTimer = setInterval(() => { for (const ws of wss.clients) ws.heartbeat(); }, 10000);
  const verifyTimer = setInterval(() => { void revalidate(); }, 5000);
  const timers = [tickTimer, saveTimer, heartbeatTimer, verifyTimer];
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, bind, resolve); }); }
  catch (error) { timers.forEach(clearInterval); wss.close(); throw error; }
  async function close() {
    if (closing) return;
    closing = true;
    timers.forEach(clearInterval);
    for (const ws of wss.clients) ws.close(1001, 'Server closed');
    for (const ws of wss.clients) ws.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
    await save();
    await admin.save().catch(() => {});
  }
  return { server, simulation, admin, config, rules, build, status, save, close, tick, port: server.address().port };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const env = process.env;
  const app = await createGunsServer({ port: +(env.MC_GUNS_PORT ?? 8091), bind: env.MC_GUNS_BIND ?? '127.0.0.1',
    // deploy-guns.sh names: MC_GUNS_STATE_DIR, MC_GUNS_CONFIG_DIR, MC_GUNS_PACK_DIR, MC_GUNS_PROFILE_API (the short names still work).
    stateDir: env.MC_GUNS_STATE_DIR ?? env.MC_GUNS_STATE ?? path.join(ROOT, 'guns-data'),
    configDir: env.MC_GUNS_CONFIG_DIR ?? env.MC_GUNS_STATE_DIR ?? env.MC_GUNS_STATE ?? path.join(ROOT, 'guns-data'),
    packDir: env.MC_GUNS_PACK_DIR ?? env.MC_GUNS_PACKS ?? path.join(ROOT, 'public/mods'),
    profiles: env.MC_GUNS_PROFILE_API ?? env.MC_PROFILE_URL ?? 'http://127.0.0.1:8090',
    origins: [...DEFAULT_ORIGINS, ...(env.MC_GUNS_ORIGINS ?? '').split(',').filter(Boolean)] });
  console.log(`Gun server on ${env.MC_GUNS_BIND ?? '127.0.0.1'}:${app.port}, build ${app.build}, packs ${app.rules.pack.slice(0, 12)}, protocol ${PROTOCOL}`);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void app.close().then(() => process.exit(0), error => { console.error(error.message); process.exit(1); }); });
}
