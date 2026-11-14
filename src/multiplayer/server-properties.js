// Batch 69 serverprops: server.properties for the dedicated server (native: DedicatedServer + PropertyManager).
//
// Evidence labels used below. The unchanged 1.7.10 jar in tools/research is the CLIENT jar: it holds MinecraftServer, NetHandlerPlayServer, ServerConfigurationManager, WorldServer
// and PlayerManager, but NOT DedicatedServer (lt) or PropertyManager (lq). So:
//   bytecode-read = read with javap -c -p from the jar (class names are the obfuscated ones: mt WorldServer, nh NetHandlerPlayServer, oi ServerConfigurationManager, mq PlayerManager,
//                   sa Entity, mx ItemInWorldManager, MinecraftServer unchanged).
//   recalled      = from memory of the 1.7.10 sources; DedicatedServer / PropertyManager are only known this way. Every such line says so.
//
// Property keys and their native defaults (recalled, DedicatedServer.startServer / PropertyManager.<init> in 1.7.10): see PROPERTY_DEFAULTS. Note the native defaults differ from this
// server's old command line defaults (gamemode 0 = survival, difficulty 1, max-players 20, spawn-protection 16, allow-flight false). A server.properties created now carries the native
// ones; the command line flags and MC_WEB_* variables still override a value without changing the file.
//
// What each key does here, and the native rule behind it (bytecode-read unless marked):
//   view-distance      ServerConfigurationManager.a(int) (oi.a) stores the raw value in oi.q and passes it to every WorldServer's PlayerManager.a(int), which clamps it to 3..20
//                      (qh.a(v, 3, 20), mq.a). oi.s() returns the RAW value: the active chunk set of ahb.C (b67 serverchunks) uses it, and the entity tracker's limit
//                      PlayerManager.b(oi.s()) = v * 16 - 16 (mq.b) does too (b68 summon2). The clamped value is the radius of chunks sent to clients.
//   max-players        oi.a(SocketAddress, GameProfile) (oi, the last check): `playerList.size() >= maxPlayers` refuses with "The server is full!".
//   spawn-protection   MinecraftServer.a(World, x, y, z, EntityPlayer) is `false` in the base class (ms.a) and `getSpawnProtectionSize` ms.ao() is 16; NetHandlerPlayServer C07 status 0
//                      (nh.a(ji)) calls it and, when it answers true, sends S23 for the cell instead of starting to dig; C08 (nh.a(jo)) skips ItemInWorldManager.onBlockClicked/place
//                      (mx.a(...)) when it answers true and still sends the two S23 resends. DedicatedServer's override is RECALLED: dimension 0 only; false when the ops list is empty;
//                      false for an op; false when the size is <= 0; else max(|x - spawnX|, |z - spawnZ|) <= size.
//   allow-nether       Entity.onEntityUpdate (sa.C): a player in a portal only counts up when MinecraftServer.w() (getAllowNether) is true; otherwise the portal counter does not move
//                      and the in-portal flag is not reset (the `an = false` store is skipped). MinecraftServer.func_71190_q (ms line 1247) also skips ticking every world but the
//                      Overworld when it is false (not reproduced here: the Nether and End of a running server keep ticking).
//   allow-flight       nh.a(jd) (movement): when MinecraftServer.ac() is false, the player is not in Creative (mx.d), the player's box grown by 0.0625 and extended 0.55 down touches no
//                      block (mt.c) and the vertical move is >= -0.03125, a counter f is incremented; above 80 it kicks "Flying is not enabled on this server". Any other tick sets f to 0.
//   spawn-animals      WorldServer.a(Entity, boolean) (mt.a) removes every EntityAnimal (wf) and EntityWaterMob (wu) as it is spawned when MinecraftServer.Z() is false; the same flag is
//   spawn-npcs         the peaceful argument of ahb.a(hostile, peaceful) for natural spawning. mt.a removes an INpc (yu) when MinecraftServer.aa() is false.
//   spawn-monsters     MinecraftServer.a(String, ...) lines 83..98 (the difficulty setter): a dedicated server calls world.setAllowedSpawnTypes(Q(), canSpawnAnimals), Q() being the
//                      spawn-monsters property in DedicatedServer (RECALLED; the base Q() is true). This repo's spawn pass already passes `difficulty != peaceful` and the hostile mobs
//                      of a peaceful world are removed by EntityMob.onUpdate natively, so the observable result is the same.
//   generate-structures MinecraftServer.a(...) builds `new WorldSettings(seed, gameType, h() = canStructuresGenerate, k() = hardcore, type)` ONLY when the level has no level.dat; a saved
//   hardcore           world ignores both properties. So here both are creation-time values kept in the save (the finite server world, generation 9, has no structure generator to switch).
//                      Hardcore: the same setter forces difficulty HARD (ms lines 29..42), and nh.a(ji... C16 perform respawn, nh line ~1975) with a hardcore world adds a ban entry
//                      (source "(You just lost the game)", reason "Death in Hardcore") and kicks with "You have died. Game over, man, it's game over!" instead of respawning.
//   difficulty         rd.a(id) = values[id % 4]; applied at startup to every world. A saved difficulty (set by /difficulty) wins, as the repo already did.
//   gamemode           ahk.a(id) with unknown ids falling to survival; the mode a new player starts in (oi.a(mw, mw, ahb): the world's game type for a first join).
//   force-gamemode     oi.r (ahk) is set from the property (DedicatedServer, RECALLED) and oi.a(mw, mw, ahb) puts every joining player in it (mx.a(ahk), oi line 2325 area).
//   pvp                mw.ab() = MinecraftServer.ab(); already wired by batch 63.
//   enable-command-block  already wired by batch 64.
//   op-permission-level, white-list   already wired by batch 68 (server-admin.js).
//   motd, server-icon.png  the status answer (server-ping.js). The icon is RECALLED: DedicatedServer reads server-icon.png and refuses one that is not 64x64.
//   max-build-height   MinecraftServer.af() (the field E) replaces the 256 in nh C07 / C08 and in the "build.tooHigh" text. The (v + 8) / 16 * 16 rounding and the 64..256 clamp are
//                      RECALLED from DedicatedServer.
//   player-idle-timeout  MinecraftServer.d() / nh idle kick (batch 68, "/setidletimeout"); the property is the starting value.

import { collisionBoxes } from '../world.js';

export const PROPERTY_DEFAULTS = Object.freeze([
  ['generator-settings', ''], ['op-permission-level', '4'], ['allow-nether', 'true'], ['level-name', 'world'], ['enable-query', 'false'], ['allow-flight', 'false'],
  ['server-port', '25565'], ['level-type', 'DEFAULT'], ['enable-rcon', 'false'], ['force-gamemode', 'false'], ['level-seed', ''], ['server-ip', ''], ['max-build-height', '256'],
  ['spawn-npcs', 'true'], ['white-list', 'false'], ['spawn-animals', 'true'], ['hardcore', 'false'], ['snooper-enabled', 'true'], ['online-mode', 'true'], ['resource-pack', ''],
  ['pvp', 'true'], ['difficulty', '1'], ['enable-command-block', 'false'], ['gamemode', '0'], ['player-idle-timeout', '0'], ['max-players', '20'], ['spawn-monsters', 'true'],
  ['generate-structures', 'true'], ['view-distance', '10'], ['motd', 'A Minecraft Server'], ['spawn-protection', '16'],
].map(Object.freeze)); // labelled recalled

export const HONOURED_KEYS = Object.freeze(['view-distance', 'max-players', 'spawn-protection', 'allow-nether', 'allow-flight', 'spawn-animals', 'spawn-monsters', 'spawn-npcs',
  'generate-structures', 'difficulty', 'gamemode', 'force-gamemode', 'hardcore', 'pvp', 'enable-command-block', 'op-permission-level', 'white-list', 'motd', 'max-build-height',
  'player-idle-timeout']);

export const FLY_KICK_TEXT = 'Flying is not enabled on this server'; // nh ldc, bytecode-read
export const FULL_TEXT = 'The server is full!'; // oi ldc, bytecode-read
export const HARDCORE_KICK_TEXT = "You have died. Game over, man, it's game over!"; // nh ldc, bytecode-read
export const HARDCORE_BAN_SOURCE = '(You just lost the game)'; // nh ldc
export const HARDCORE_BAN_REASON = 'Death in Hardcore'; // nh ldc
export const FLOAT_TICKS = 80; // nh: f > 80
export const FLOAT_MIN_DY = -0.03125; // nh: dcmpl against -0.03125

// ---- java.util.Properties text format -------------------------------------------------------------------------------------------------

const UNESCAPE = { t: '\t', n: '\n', r: '\r', f: '\f' };
export function parseProperties(text) {
  const map = new Map(), lines = String(text).split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/^[ \t\f]+/, '');
    if (!line || line[0] === '#' || line[0] === '!') continue;
    // a line ending in an odd number of backslashes continues on the next line (leading white space of the next line is dropped)
    while (/(?:^|[^\\])(?:\\\\)*\\$/.test(line) && i + 1 < lines.length) line = line.slice(0, -1) + lines[++i].replace(/^[ \t\f]+/, '');
    let k = 0, key = '';
    while (k < line.length) { // key ends at an unescaped = : or white space
      const c = line[k];
      if (c === '\\') { key += line.slice(k, k + 2); k += 2; continue; }
      if (c === '=' || c === ':' || c === ' ' || c === '\t' || c === '\f') break;
      key += c; k++;
    }
    let rest = line.slice(k).replace(/^[ \t\f]*/, '');
    if (rest[0] === '=' || rest[0] === ':') rest = rest.slice(1).replace(/^[ \t\f]*/, '');
    map.set(unescape(key), unescape(rest));
  }
  return map;
}
function unescape(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\') { out += s[i]; continue; }
    const n = s[++i];
    if (n === 'u' && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 1, i + 5))) { out += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16)); i += 4; }
    else if (n === undefined) break;
    else out += UNESCAPE[n] ?? n;
  }
  return out;
}
// Properties.store escaping: key escapes space and = : # !; a value escapes a leading space and = : # !; both escape the backslash, control characters and non-ASCII.
function escapeText(s, key) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], code = s.charCodeAt(i);
    if (c === '\\') out += '\\\\';
    else if (c === '\t') out += '\\t'; else if (c === '\n') out += '\\n'; else if (c === '\r') out += '\\r'; else if (c === '\f') out += '\\f';
    else if (c === ' ') out += key || i === 0 ? '\\ ' : ' ';
    else if (c === '=' || c === ':' || c === '#' || c === '!') out += '\\' + c;
    else if (code < 0x20 || code > 0x7e) out += '\\u' + code.toString(16).toUpperCase().padStart(4, '0');
    else out += c;
  }
  return out;
}
// Properties.store(out, "Minecraft server properties"): the comment line, the Date.toString() line, then key=value. The native order is Hashtable order (not reproducible); the
// defaults' order is used for known keys, unknown keys keep the order they were read in.
export function formatProperties(map, date = new Date()) {
  const day = date.toUTCString().split(' '); // Sat, 14 Nov 2026 12:00:00 GMT
  const stamp = `${day[0].slice(0, 3)} ${day[2]} ${day[1]} ${day[4]} UTC ${day[3]}`;
  const known = PROPERTY_DEFAULTS.map(([k]) => k), keys = [...known.filter(k => map.has(k)), ...[...map.keys()].filter(k => !known.includes(k))];
  return `#Minecraft server properties\n#${stamp}\n${keys.map(k => `${escapeText(k, true)}=${escapeText(map.get(k), false)}`).join('\n')}\n`;
}

// Integer.parseInt: optional sign, ASCII digits only, 32-bit range.
export function javaParseInt(s) {
  if (!/^[+-]?\d+$/.test(String(s))) return null;
  const n = Number(s);
  return n >= -2147483648 && n <= 2147483647 ? n : null;
}

// PropertyManager (lq, RECALLED): getStringProperty adds a missing key with its default and marks the file for saving; getIntProperty parses and falls back to the default (writing it
// back) on a bad number; getBooleanProperty is Boolean.parseBoolean (true only for "true" in any case).
export class ServerProperties {
  constructor(text = '', overrides = {}) {
    this.map = parseProperties(text); this.dirty = false; this.overrides = overrides;
  }
  has(key) { return this.map.has(key); }
  string(key, fallback) {
    if (key in this.overrides) return String(this.overrides[key]);
    if (!this.map.has(key)) { this.map.set(key, String(fallback)); this.dirty = true; }
    return this.map.get(key);
  }
  int(key, fallback) {
    const n = javaParseInt(this.string(key, fallback));
    if (n !== null) return n;
    if (!(key in this.overrides)) { this.map.set(key, String(fallback)); this.dirty = true; }
    return fallback;
  }
  bool(key, fallback) { return this.string(key, fallback).toLowerCase() === 'true'; }
  text(date) { return formatProperties(this.map, date); }
}

const GAME_NAMES = { survival: 0, creative: 1, adventure: 2, spectator: 3, s: 0, c: 1, a: 2 };
export const MODE_NAMES = ['survival', 'creative', 'adventure', 'survival']; // id 3 (spectator) does not exist in 1.7.10: ahk.a falls to survival for unknown ids
// `gamemode` may hold a number (native) or a name from the command line; an unknown value is survival (ahk.a).
export function gameTypeId(value) {
  const n = javaParseInt(value);
  if (n !== null) return n >= 0 && n <= 2 ? n : 0;
  return GAME_NAMES[String(value).toLowerCase()] ?? 0;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The values the simulation and the connection layer read. A bare `new ServerRules()` keeps the behaviour of the server before this module (no spawn protection, flying allowed, 8 players).
export class ServerRules {
  constructor(v = {}) {
    this.viewDistance = Number.isInteger(v.viewDistance) ? Math.max(1, v.viewDistance) : 10; // oi.q, the raw value
    this.maxPlayers = Number.isInteger(v.maxPlayers) && v.maxPlayers >= 1 ? v.maxPlayers : 8;
    this.spawnProtection = Number.isInteger(v.spawnProtection) ? v.spawnProtection : 0;
    this.allowNether = v.allowNether !== false;
    this.allowFlight = v.allowFlight !== false;
    this.spawnAnimals = v.spawnAnimals !== false;
    this.spawnMonsters = v.spawnMonsters !== false;
    this.spawnNpcs = v.spawnNpcs !== false;
    this.generateStructures = v.generateStructures !== false;
    this.forceGamemode = v.forceGamemode === true;
    this.hardcore = v.hardcore === true;
    this.maxBuildHeight = Number.isInteger(v.maxBuildHeight) ? v.maxBuildHeight : 256;
    this.playerIdleTimeout = Number.isInteger(v.playerIdleTimeout) && v.playerIdleTimeout > 0 ? v.playerIdleTimeout : 0;
    this.opSource = null; // { any(): boolean, is(name): boolean } the connection layer may set; the default reads the admin lists
  }
  get chunkRadius() { return clamp(this.viewDistance, 3, 20); } // PlayerManager.a(int): what clients are sent
  get trackerLimit() { return this.viewDistance * 16 - 16; } // PlayerManager.b(oi.s()), the raw value
  get restrictsSpawns() { return !this.spawnAnimals || !this.spawnNpcs; }
  // ServerConfigurationManager.a(SocketAddress, GameProfile) last check: the player list is not below the maximum.
  full(online) { return online >= this.maxPlayers; }
  // DedicatedServer.isBlockProtected (RECALLED, see the header) for the player `p` of `sim` at a block cell.
  protects(sim, p, [x, , z]) {
    if ((p.dimension | 0) !== 0) return false;
    const size = this.spawnProtection;
    const any = this.opSource ? this.opSource.any() : sim.admin.ops.size > 0;
    if (!any) return false;
    if (this.opSource ? this.opSource.is(p.name) : sim.admin.isOpName(p.name)) return false;
    if (size <= 0) return false;
    const s = sim.worldSpawn ?? (() => { const at = sim.world.spawn(); return [Math.floor(at.x), Math.floor(at.y), Math.floor(at.z)]; })();
    return Math.max(Math.abs(x - s[0]), Math.abs(z - s[2])) <= size;
  }
}

// The typed rules and the sim options for a ServerProperties plus the command line / environment values. `overrides` is already keyed by property name.
export function resolveSettings(props) {
  const diff = props.int('difficulty', 1), difficulty = diff >= 0 ? diff % 4 : 1;
  const heightRaw = props.int('max-build-height', 256);
  const height = clamp(Math.trunc((heightRaw + 8) / 16) * 16, 64, 256); // RECALLED from DedicatedServer
  const rules = new ServerRules({
    viewDistance: props.int('view-distance', 10), maxPlayers: props.int('max-players', 20), spawnProtection: props.int('spawn-protection', 16),
    allowNether: props.bool('allow-nether', true), allowFlight: props.bool('allow-flight', false), spawnAnimals: props.bool('spawn-animals', true),
    spawnMonsters: props.bool('spawn-monsters', true), spawnNpcs: props.bool('spawn-npcs', true), generateStructures: props.bool('generate-structures', true),
    forceGamemode: props.bool('force-gamemode', false), hardcore: props.bool('hardcore', false), maxBuildHeight: height, playerIdleTimeout: props.int('player-idle-timeout', 0),
  });
  const gameType = gameTypeId(props.string('gamemode', '0'));
  return {
    rules, difficulty, gameType, gameMode: MODE_NAMES[gameType], pvp: props.bool('pvp', true), commandBlocks: props.bool('enable-command-block', false),
    opLevel: props.int('op-permission-level', 4), whitelist: props.bool('white-list', false), motd: props.string('motd', 'A Minecraft Server'),
  };
}

// The names a command line flag or an environment variable may use for a property: `--view-distance 12`, MC_WEB_VIEW_DISTANCE=12, plus the older names of the keys that
// already had flags (--command-blocks, MC_WEB_COMMAND_BLOCKS, MC_WEB_OP_LEVEL, MC_WEB_WHITELIST).
const ALIASES = { 'enable-command-block': ['--command-blocks', 'MC_WEB_COMMAND_BLOCKS'], 'op-permission-level': ['MC_WEB_OP_LEVEL'], 'white-list': ['MC_WEB_WHITELIST'] };
export function overridesFrom(args = [], env = {}) {
  const out = {}, flag = name => { const at = args.indexOf(name); return at >= 0 && at + 1 < args.length ? args[at + 1] : undefined; };
  for (const [key] of PROPERTY_DEFAULTS) {
    const names = ['--' + key, 'MC_WEB_' + key.toUpperCase().replace(/-/g, '_'), ...(ALIASES[key] ?? [])];
    for (const n of names) { const v = n.startsWith('--') ? flag(n) : env[n]; if (v !== undefined && v !== '') { out[key] = v; break; } }
  }
  return out;
}

// ---- files ------------------------------------------------------------------------------------------------------------------------------

// Reads (or creates, with every key at its native default) `server.properties` in `dir`; keys missing from an older file are added and the file is rewritten, as PropertyManager does.
export async function loadServerProperties(dir, { overrides = {}, fs = null, now = () => new Date() } = {}) {
  fs ??= await import('node:fs/promises');
  const path = (await import('node:path')).join(dir, 'server.properties');
  let text = '', existed = true;
  try { text = await fs.readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; existed = false; }
  const props = new ServerProperties(text, overrides);
  for (const [key, value] of PROPERTY_DEFAULTS) if (!props.map.has(key)) { props.map.set(key, value); props.dirty = true; }
  const settings = resolveSettings(props); // may also write back a bad number's default
  if (props.dirty || !existed) { await fs.mkdir(dir, { recursive: true, mode: 0o700 }); await fs.writeFile(path, props.text(now()), { mode: 0o644 }); }
  return { props, path, created: !existed, ...settings };
}

// server-icon.png: a PNG of exactly 64 x 64 pixels becomes the status favicon (RECALLED: DedicatedServer refuses other sizes). Returns { favicon } or { error }.
export function faviconFromPng(buffer) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!buffer || buffer.length < 33 || sig.some((b, i) => buffer[i] !== b) || buffer.toString('latin1', 12, 16) !== 'IHDR') return { error: 'Not a PNG image' };
  const w = buffer.readUInt32BE(16), h = buffer.readUInt32BE(20);
  if (w !== 64) return { error: 'Must be 64 pixels wide' };
  if (h !== 64) return { error: 'Must be 64 pixels high' };
  return { favicon: 'data:image/png;base64,' + buffer.toString('base64') };
}
export async function loadFavicon(dir, { fs = null, warn = () => {} } = {}) {
  fs ??= await import('node:fs/promises');
  const file = (await import('node:path')).join(dir, 'server-icon.png');
  let data;
  try { data = await fs.readFile(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (data.length > 1 << 20) { warn('server-icon.png is over 1 MiB'); return null; }
  const r = faviconFromPng(data);
  if (r.error) { warn(`Couldn't load server icon: ${r.error}`); return null; }
  return r.favicon;
}

// ---- simulation hooks -------------------------------------------------------------------------------------------------------------------

// Spawn protection for one block click. Returns true when the click is refused (the caller resends the cell, as nh does).
export const blockProtected = (sim, p, cell) => !!sim.rules?.protects(sim, p, cell);

// nh.a(jd): the floating counter of one player for one tick. `onGround` is "the box grown by 0.0625 and extended 0.55 down touches a block"; `dy` the vertical move of the tick.
// Returns true when the player is to be kicked now.
export function floatTick(rules, p, { onGround, dy }) {
  if (rules.allowFlight || p.survival?.creative || p.sleeping || p.dead) { p.floating = 0; return false; }
  if (!onGround && dy >= FLOAT_MIN_DY) { p.floating = (p.floating | 0) + 1; return p.floating > FLOAT_TICKS; }
  p.floating = 0;
  return false;
}

// Native respawn request of a hardcore world: a ban entry and a kick, no respawn. Returns true when it handled the request.
export function hardcoreRespawn(sim, id, now = () => new Date()) {
  const p = sim.players.get(id);
  if (!sim.hardcore || !p?.dead) return false;
  const created = (d => { const z = n => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())} +0000`; })(now());
  const uuid = p.resumeKey;
  if (typeof uuid === 'string') sim.admin.bans.set(uuid, { uuid, name: p.name, created, source: HARDCORE_BAN_SOURCE, expires: 'forever', reason: HARDCORE_BAN_REASON });
  sim.admin.host?.kick(id, HARDCORE_KICK_TEXT);
  return true;
}

// World.checkBlockCollision of nh's box: the player's box grown by 0.0625 on every side and extended 0.55 down (feet at p.position.y).
export function touchesBlockBelow(world, x, y, z) {
  const g = 0.0625, r = 0.3 + g, y0 = y - g - 0.55, y1 = y + 1.8 + g;
  for (let bx = Math.floor(x - r); bx <= Math.floor(x + r); bx++) for (let bz = Math.floor(z - r); bz <= Math.floor(z + r); bz++) for (let by = Math.floor(y0) - 1; by <= Math.floor(y1); by++)
    for (const [a0, b0, c0, a1, b1, c1] of collisionBoxes(world, bx, by, bz)) if (x - r < bx + a1 && x + r > bx + a0 && y0 < by + b1 && y1 > by + b0 && z - r < bz + c1 && z + r > bz + c0) return true;
  return false;
}
// The simulation's per-player call (after movePlayer): kicks a player who floated too long when allow-flight is off.
export function flightCheck(sim, p) {
  if (sim.rules.allowFlight) return;
  const dy = p.position.y - (p.previous?.y ?? p.position.y);
  if (floatTick(sim.rules, p, { onGround: touchesBlockBelow(p.world ?? sim.world, p.position.x, p.position.y, p.position.z), dy })) { p.floating = 0; sim.admin.host?.kick(p.id, FLY_KICK_TEXT); }
}

// Called once per simulation tick before the players move: hardcore difficulty.
export function hardcoreTick(sim) { if (sim.hardcore) sim.difficulty = 3; }

// Kinds natively removed as they spawn (WorldServer.a(Entity, boolean)): EntityAnimal, EntityWaterMob, INpc. Names as the simulation's mob types.
export const ANIMAL_KINDS = new Set(['pig', 'cow', 'sheep', 'chicken', 'wolf', 'ocelot', 'horse', 'mooshroom']);
export const WATER_KINDS = new Set(['squid']);
export const NPC_KINDS = new Set(['villager']);
export const removedAtSpawn = (rules, type) => ((ANIMAL_KINDS.has(type) || WATER_KINDS.has(type)) && !rules.spawnAnimals) || (NPC_KINDS.has(type) && !rules.spawnNpcs);
