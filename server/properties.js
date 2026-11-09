// Java-server-style configuration for the multiplayer gun-arena server: server.properties plus the 1.7.10
// whitelist/ops/banned-players JSON lists, mapped to website account IDs. Keys and entries this server cannot
// honour are listed in a validation report instead of being silently accepted. Website sessions are always required.
import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const INT_MAX = 2 ** 31 - 1;
const REDACTED = '<redacted>';
const secretKey = key => /password|secret|token/i.test(key);

export const DEFAULT_CONFIG = Object.freeze({
  motd: 'ledoge0 Survival - CS2 Unified', gamemode: 'survival', forceGamemode: false, difficulty: 2, hardcore: false, pvp: true,
  maxPlayers: 8, whitelist: true, enforceWhitelist: true, levelName: 'guns-survival', levelSeed: '', spawnProtection: 16,
  idleTimeout: 0, opPermissionLevel: 4, generateStructures: true, spawnMonsters: true, spawnAnimals: true, spawnNpcs: true,
  allowNether: true, viewDistance: 6, allowFlight: false, levelType: 'DEFAULT', generatorSettings: '', maxBuildHeight: 256,
  enableCommandBlock: false, announcePlayerAchievements: true,
});

export const DEFAULT_PROPERTIES = `# mc-web gun-arena server properties. Key names follow Minecraft Java 1.7.10 server.properties.
# Players always sign in with website accounts: online-mode, server-ip and server-port are ignored, and the
# service binds loopback behind the deployment gateway. RCON and query are not implemented.
# Unsupported, unknown or invalid entries are listed in the startup report instead of being silently accepted.

# Applied now
motd=ledoge0 Survival - CS2 Unified
# 0/survival, 1/creative, 2/adventure (1.7.10 has no spectator mode)
gamemode=0
force-gamemode=false
# 0/peaceful, 1/easy, 2/normal, 3/hard
difficulty=2
pvp=true
# 1-20
max-players=8
white-list=true
# Not a 1.7.10 key: kick online players who are not whitelisted when the whitelist is enabled or reloaded
enforce-whitelist=true
# World directory name: 1-64 letters, digits, _ . or -
level-name=guns-survival
# Blank picks a random seed
level-seed=
spawn-protection=16
# Minutes; 0 never kicks idle players
player-idle-timeout=0
# 1-4
op-permission-level=4

# Parsed and validated now; these take effect with full Survival world authority
hardcore=false
generate-structures=true
spawn-monsters=true
spawn-animals=true
spawn-npcs=true
allow-nether=true
# 3-15
view-distance=6
allow-flight=false
# DEFAULT, FLAT, LARGEBIOMES or AMPLIFIED
level-type=DEFAULT
generator-settings=
# 64-256, rounded to a multiple of 16
max-build-height=256
enable-command-block=false
announce-player-achievements=true
`;

// java.util.Properties.load: logical lines, comments, separators and escapes.
const WHITESPACE = /^[ \t\f]+/;
const ESCAPES = { t: '\t', n: '\n', r: '\r', f: '\f' };
const oddBackslashes = s => (s.length - s.replace(/\\+$/, '').length) % 2 === 1;
const unescape = (s, line) => s.replace(/\\(?:u([\s\S]{0,4})|([\s\S]))/g, (_, hex, c) => {
  if (hex === undefined) return ESCAPES[c] ?? c;
  if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new SyntaxError(`Malformed \\uxxxx escape on server.properties line ${line}`);
  return String.fromCharCode(parseInt(hex, 16));
});

export function parseProperties(text) {
  const lines = String(text).split(/\r\n|\r|\n/), out = new Map();
  for (let i = 0; i < lines.length; i++) {
    const start = i + 1;
    let line = lines[i].replace(WHITESPACE, '');
    if (!line || line[0] === '#' || line[0] === '!') continue;
    // An odd run of trailing backslashes continues onto the next line, minus its leading whitespace.
    while (oddBackslashes(line)) {
      line = line.slice(0, -1);
      if (++i >= lines.length) break;
      line += lines[i].replace(WHITESPACE, '');
    }
    let k = 0, escaped = false;
    for (; k < line.length; k++) {
      const c = line[k];
      if (!escaped && (c === '=' || c === ':' || c === ' ' || c === '\t' || c === '\f')) break;
      escaped = c === '\\' && !escaped;
    }
    // Whitespace, then at most one '=' or ':' (unless the key already ended at one), then whitespace.
    let at = k + 1, separator = line[k] === '=' || line[k] === ':';
    for (; at < line.length; at++) {
      const c = line[at];
      if (c === ' ' || c === '\t' || c === '\f') continue;
      if (!separator && (c === '=' || c === ':')) { separator = true; continue; }
      break;
    }
    out.set(unescape(line.slice(0, k), start), unescape(line.slice(at), start));
  }
  return Object.fromEntries(out); // own data properties, so even a "__proto__" key stays inert
}

// java.util.Properties.store escaping: ASCII output with \uXXXX for everything else.
const NAMED = { '\t': '\\t', '\n': '\\n', '\r': '\\r', '\f': '\\f' };
const escapeProperty = (s, key) => String(s).replace(/[\x00-\x20\x7f-￿=:#!\\]/g, (c, i) =>
  c === ' ' ? (key || i === 0 ? '\\ ' : ' ') : c === '\\' || '=:#!'.includes(c) ? '\\' + c :
    NAMED[c] ?? '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));

export function stringifyProperties(obj, header) {
  const comments = header == null ? [] : String(header).split(/\r\n|\r|\n/).map(line => /^[#!]/.test(line) ? line : '#' + line);
  const body = Object.keys(obj).sort().map(key => escapeProperty(key, true) + '=' + escapeProperty(obj[key] ?? '', false));
  return [...comments, ...body].join('\n') + '\n';
}

// Value parsers return { value }, { error } (keep the default) or { value, error } (corrected value, reported invalid).
const bool = s => /^(true|false)$/i.test(s.trim()) ? { value: s.trim().toLowerCase() === 'true' } : { error: 'expected true or false' };
const span = (min, max) => max >= INT_MAX ? `${min} or more` : `${min}–${max}`;
const int = (min, max) => s => {
  const t = s.trim(), n = +t;
  if (!/^[+-]?\d+$/.test(t) || n < -INT_MAX - 1 || n > INT_MAX) return { error: `expected a whole number ${span(min, max)}` };
  const value = Math.min(max, Math.max(min, n));
  return value === n ? { value } : { value, error: `outside ${span(min, max)}; clamped to ${value}` };
};
const choice = (names, error) => s => {
  const t = s.trim(), key = /^[+-]?\d+$/.test(t) ? String(+t) : t.toLowerCase();
  return Object.hasOwn(names, key) ? { value: names[key] } : { error };
};
const text = s => ({ value: s });
const motd = s => {
  const chars = [...s];
  return chars.length > 100 ? { value: chars.slice(0, 100).join(''), error: 'longer than 100 characters; truncated' } : { value: s };
};
const levelName = s => /^[A-Za-z0-9_.-]{1,64}$/.test(s.trim()) && !/^\.+$/.test(s.trim()) ? { value: s.trim() }
  : { error: 'expected 1–64 letters, digits, _ . or - (it names the world directory)' };
const buildHeight = s => { // DedicatedServer: round to a multiple of 16, then clamp to 64–256
  const n = int(-INT_MAX - 1, INT_MAX)(s);
  if (n.error) return { error: 'expected a whole number 64–256' };
  const value = Math.min(256, Math.max(64, Math.trunc((n.value + 8) / 16) * 16));
  return value === n.value ? { value } : { value, error: `not a multiple of 16 within 64–256; using ${value} as 1.7.10 does` };
};
const gamemode = choice({ 0: 'survival', 1: 'creative', 2: 'adventure', survival: 'survival', creative: 'creative', adventure: 'adventure' },
  'expected 0–2 or survival, creative, adventure (1.7.10 has no spectator mode)');
const difficulty = choice({ 0: 0, 1: 1, 2: 2, 3: 3, peaceful: 0, easy: 1, normal: 2, hard: 3 }, 'expected 0–3 or peaceful, easy, normal, hard');
const levelType = choice({ default: 'DEFAULT', flat: 'FLAT', largebiomes: 'LARGEBIOMES', amplified: 'AMPLIFIED' },
  'expected DEFAULT, FLAT, LARGEBIOMES or AMPLIFIED');

const DEFERRED = 'parsed; takes effect with full Survival world authority';
const FIELDS = new Map([
  ['motd', 'motd', motd], ['gamemode', 'gamemode', gamemode], ['force-gamemode', 'forceGamemode', bool],
  ['difficulty', 'difficulty', difficulty], ['pvp', 'pvp', bool], ['max-players', 'maxPlayers', int(1, 20)],
  ['white-list', 'whitelist', bool], ['level-name', 'levelName', levelName], ['level-seed', 'levelSeed', text],
  ['enforce-whitelist', 'enforceWhitelist', bool, 'applied', 'not a 1.7.10 key; non-whitelisted players are kicked when the whitelist is enabled or reloaded'],
  ['spawn-protection', 'spawnProtection', int(0, 256)], ['player-idle-timeout', 'idleTimeout', int(0, INT_MAX)],
  ['op-permission-level', 'opPermissionLevel', int(1, 4)],
  ...[['hardcore', 'hardcore', bool], ['generate-structures', 'generateStructures', bool], ['spawn-monsters', 'spawnMonsters', bool],
    ['spawn-animals', 'spawnAnimals', bool], ['spawn-npcs', 'spawnNpcs', bool], ['allow-nether', 'allowNether', bool],
    ['view-distance', 'viewDistance', int(3, 15)], ['allow-flight', 'allowFlight', bool], ['level-type', 'levelType', levelType],
    ['generator-settings', 'generatorSettings', text], ['max-build-height', 'maxBuildHeight', buildHeight],
    ['enable-command-block', 'enableCommandBlock', bool], ['announce-player-achievements', 'announcePlayerAchievements', bool],
  ].map(field => [...field, 'deferred', DEFERRED]),
].map(([key, prop, parse, status = 'applied', note = '']) => [key, { prop, parse, status, note }]));

const RCON = 'RCON is not implemented', QUERY = 'the query protocol is not implemented';
const TOGGLES = new Map([['enable-rcon', RCON], ['enable-query', QUERY]]);
const IGNORED = new Map(Object.entries({
  'online-mode': 'website account sessions are always required; online-mode=false never disables them',
  'server-port': 'the service always binds loopback; the port is set by deployment',
  'server-ip': 'the service always binds loopback; the address is set by deployment',
  'network-compression-threshold': 'Java packet compression does not apply to the WebSocket protocol',
  'use-native-transport': 'Java network transport setting; not applicable',
  'prevent-proxy-connections': 'needs Mojang session-server address checks; not applicable',
  'snooper-enabled': 'no usage snooper is sent',
  'resource-pack': 'server resource packs are not offered to web clients',
  'resource-pack-sha1': 'server resource packs are not offered to web clients',
  'max-tick-time': 'there is no tick watchdog',
  'max-world-size': 'there is no world border',
  'broadcast-rcon-to-ops': RCON,
  'broadcast-console-to-ops': 'console output is not broadcast to operators',
  'debug': 'Java server debug flag; not applicable',
  'rcon.port': RCON, 'rcon.password': RCON, 'query.port': QUERY,
}));

export function readServerConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG }, report = [];
  for (const [key, rawValue] of Object.entries(raw)) {
    const value = String(rawValue);
    const add = (status, note) => report.push({ key, value: secretKey(key) ? REDACTED : value, status, note });
    const field = FIELDS.get(key);
    if (field) {
      const result = field.parse(value);
      if ('value' in result) config[field.prop] = result.value;
      if (!result.error) add(field.status, field.note);
      else add('invalid', 'value' in result ? result.error : `${result.error}; using default ${DEFAULT_CONFIG[field.prop]}`);
    } else if (TOGGLES.has(key)) {
      const on = bool(value);
      if (on.error) add('invalid', `${on.error}; ${TOGGLES.get(key)}`);
      else add(on.value ? 'unsupported' : 'ignored', TOGGLES.get(key));
    } else if (IGNORED.has(key)) add('ignored', IGNORED.get(key));
    else add('unknown', 'not a server.properties key this server reads');
  }
  return { config, report };
}

const printable = s => String(s).replace(/[\x00-\x1f\x7f]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
export const formatReport = report => report.map(({ key, value, status, note }) =>
  `${status} ${printable(key)}${value == null ? '' : '=' + (secretKey(key) ? REDACTED : printable(value))}${note ? ': ' + note : ''}`);

// Admin lists. Vanilla 1.7.10 identifies players by Mojang UUID; here `uuid` holds the website account ID.
const UUID = /^([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})$/i;
const normalId = id => { const m = typeof id === 'string' && UUID.exec(id.trim()); return m ? m.slice(1).join('-').toLowerCase() : null; };
const javaDate = ms => new Date(ms).toISOString().slice(0, 19).replace('T', ' ') + ' +0000'; // yyyy-MM-dd HH:mm:ss Z
const parseJavaDate = s => {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2}):?(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, sec, sign, oh, om] = m;
  return Date.UTC(+y, mo - 1, +d, +h, +mi, +sec) - (sign === '-' ? -1 : 1) * (oh * 60 + +om) * 60000;
};
const FILES = { whitelist: 'whitelist.json', ops: 'ops.json', bans: 'banned-players.json' };
const SERIALIZE = {
  whitelist: e => ({ uuid: e.id, name: e.name }),
  ops: e => ({ uuid: e.id, name: e.name, level: e.level, ...('bypassesPlayerLimit' in e && { bypassesPlayerLimit: e.bypassesPlayerLimit }) }),
  bans: e => ({ uuid: e.id, name: e.name, created: javaDate(e.created), source: e.source, expires: e.expires === null ? 'forever' : javaDate(e.expires), reason: e.reason }),
};

export class AdminLists {
  constructor(dir, { now = () => Date.now(), opPermissionLevel = 4 } = {}) {
    this.dir = dir; this.now = now; this.opPermissionLevel = opPermissionLevel;
    this.lists = { whitelist: new Map(), ops: new Map(), bans: new Map() };
    this.identities = new Map(); // Java/old uuid -> website account ID, from identity-map.json (never written)
    this.report = [];
    this.dirty = new Set(); this.malformed = new Set();
    this.saving = Promise.resolve();
  }
  resolve(id, identities = this.identities) { const key = normalId(id); return key && (identities.get(key) ?? key); }
  async load() {
    await this.saving.catch(() => {});
    const report = [], malformed = new Set(), identities = new Map(), lists = { whitelist: new Map(), ops: new Map(), bans: new Map() };
    const invalid = (key, value, note) => report.push({ key, value, status: 'invalid', note });
    // undefined = missing or blank, null = malformed
    const read = async (file, shape) => {
      let text;
      try { text = await readFile(path.join(this.dir, file), 'utf8'); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
      if (!text.trim()) return undefined;
      try { const data = JSON.parse(text.replace(/^﻿/, '')); if (data && typeof data === 'object' && Array.isArray(data) === (shape === 'array')) return data; } catch {}
      return null;
    };
    const map = await read('identity-map.json', 'object');
    if (map === null) invalid('identity-map.json', null, 'malformed JSON (expected an object of uuid to account ID); no identities mapped');
    for (const [from, to] of Object.entries(map ?? {})) {
      if (normalId(from) && normalId(to)) identities.set(normalId(from), normalId(to));
      else invalid(`identity-map.json[${from}]`, typeof to === 'string' ? to : null, 'expected a uuid mapped to a website account ID; skipped');
    }
    for (const [list, file] of Object.entries(FILES)) {
      const entries = await read(file, 'array');
      if (entries === null) { malformed.add(list); invalid(file, null, 'malformed JSON (expected an array); treated as empty and kept until a command changes the list'); }
      (entries ?? []).forEach((entry, i) => {
        const key = `${file}[${i}]`;
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return invalid(key, null, 'expected an object; skipped');
        const id = this.resolve(entry.uuid, identities), name = typeof entry.name === 'string' ? entry.name : '';
        if (!id) return invalid(key, name, 'unresolved: no valid uuid; entries are never matched by name because website names can change');
        if (list === 'whitelist') return lists.whitelist.set(id, { id, name });
        if (list === 'ops') {
          let level = entry.level === undefined ? this.opPermissionLevel : Number(entry.level);
          if (!Number.isInteger(level) || level < 1 || level > 4) { invalid(key, name, `level must be 1–4; using ${this.opPermissionLevel}`); level = this.opPermissionLevel; }
          return lists.ops.set(id, { id, name, level, ...(typeof entry.bypassesPlayerLimit === 'boolean' && { bypassesPlayerLimit: entry.bypassesPlayerLimit }) });
        }
        // UserListBansEntry: an unreadable created date means now, an unreadable expiry means forever.
        let created = parseJavaDate(entry.created), expires = entry.expires === undefined || entry.expires === 'forever' ? null : parseJavaDate(entry.expires);
        if (created === null) { if (entry.created !== undefined) invalid(key, name, 'unreadable created date; using now'); created = this.now(); }
        if (expires === null && entry.expires !== undefined && entry.expires !== 'forever') invalid(key, name, 'unreadable expires date; ban kept as permanent');
        lists.bans.set(id, { id, name, reason: typeof entry.reason === 'string' ? entry.reason : 'Banned by an operator.',
          source: typeof entry.source === 'string' ? entry.source : 'Server', created, expires });
      });
    }
    const ips = await read('banned-ips.json', 'array');
    if (ips === null || ips?.length) report.push({ key: 'banned-ips.json', value: ips ? `${ips.length} entries` : null, status: 'unsupported',
      note: 'IP bans need trusted client IP forwarding, and the gateway loopback address must never be a ban identity; not enforced' });
    Object.assign(this, { identities, lists, report, malformed, dirty: new Set() });
    return this;
  }
  #id(id) { const key = this.resolve(id); if (!key) throw new TypeError('Admin list entries need a website account ID.'); return key; }
  #active(entry) { return entry.expires === null || entry.expires > this.now(); }
  #set(list, entry) {
    const old = this.lists[list].get(entry.id);
    if (old && JSON.stringify(old) === JSON.stringify(entry)) return false;
    this.lists[list].set(entry.id, entry); this.dirty.add(list);
    return true;
  }
  #remove(list, idOrName) {
    const entries = this.lists[list], id = this.resolve(idOrName);
    let removed = !!id && entries.delete(id);
    const lower = !removed && typeof idOrName === 'string' ? idOrName.trim().toLowerCase() : '';
    if (lower) for (const [key, entry] of entries) if (entry.name.toLowerCase() === lower) removed = entries.delete(key) || removed;
    if (removed) this.dirty.add(list);
    return removed;
  }
  whitelisted(id) { return this.lists.whitelist.has(this.resolve(id)); }
  opLevel(id) { return this.lists.ops.get(this.resolve(id))?.level ?? 0; }
  ban(id) { const entry = this.lists.bans.get(this.resolve(id)); return entry && this.#active(entry) ? { ...entry } : null; }
  addWhitelist({ id, name = '' }) { return this.#set('whitelist', { id: this.#id(id), name: String(name) }); }
  removeWhitelist(idOrName) { return this.#remove('whitelist', idOrName); }
  addOp({ id, name = '' }, level = this.opPermissionLevel) {
    if (!Number.isInteger(level) || level < 1 || level > 4) throw new RangeError('Operator levels are 1–4.');
    const key = this.#id(id), old = this.lists.ops.get(key);
    return this.#set('ops', { id: key, name: String(name), level, ...(old && 'bypassesPlayerLimit' in old && { bypassesPlayerLimit: old.bypassesPlayerLimit }) });
  }
  removeOp(idOrName) { return this.#remove('ops', idOrName); }
  addBan({ id, name = '' }, { reason = 'Banned by an operator.', source = 'Server', expires = null } = {}) {
    if (expires !== null && !Number.isFinite(expires)) throw new TypeError('Ban expiry is a millisecond timestamp or null.');
    const entry = { id: this.#id(id), name: String(name), reason: String(reason), source: String(source), created: this.now(), expires };
    this.lists.bans.set(entry.id, entry); this.dirty.add('bans');
    return { ...entry };
  }
  pardon(idOrName) { return this.#remove('bans', idOrName); }
  whitelistEntries() { return [...this.lists.whitelist.values()].map(e => ({ ...e })); }
  opEntries() { return [...this.lists.ops.values()].map(e => ({ ...e })); }
  banEntries() { return [...this.lists.bans.values()].filter(e => this.#active(e)).map(e => ({ ...e })); }
  // Serialized: a save requested while another is writing waits, then writes the state current at that time.
  save() {
    this.saving = this.saving.catch(() => {}).then(() => this.#write());
    return this.saving;
  }
  async #write() {
    for (const [id, entry] of this.lists.bans) if (!this.#active(entry)) { this.lists.bans.delete(id); this.dirty.add('bans'); }
    const pending = [...this.dirty];
    this.dirty.clear();
    try {
      if (pending.length) await mkdir(this.dir, { recursive: true, mode: 0o700 });
      for (const list of pending) {
        const file = path.join(this.dir, FILES[list]), tmp = `${file}.${process.pid}.tmp`;
        const data = JSON.stringify([...this.lists[list].values()].map(SERIALIZE[list]), null, 2);
        if (this.malformed.has(list)) {
          await copyFile(file, file + '.bak').catch(error => { if (error.code !== 'ENOENT') throw error; });
          this.malformed.delete(list);
        }
        await writeFile(tmp, data, { mode: 0o600 });
        await rename(tmp, file);
      }
    } catch (error) { for (const list of pending) this.dirty.add(list); throw error; }
  }
}

// Hosts may save server.properties as UTF-8 or, like Java's Properties.store, ISO-8859-1.
const decode = bytes => { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return bytes.toString('latin1'); } };

export async function loadServerFiles(dir, { writeDefaults = false, now } = {}) {
  const file = path.join(dir, 'server.properties');
  let text = null, raw = {}, problem = null;
  try { text = decode(await readFile(file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (text === null && writeDefaults) {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(file, DEFAULT_PROPERTIES, { mode: 0o600, flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  }
  try { if (text !== null) raw = parseProperties(text); } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    problem = { key: 'server.properties', value: null, status: 'invalid', note: `${error.message}; using defaults for every key` };
  }
  const { config, report } = readServerConfig(raw);
  const admin = await new AdminLists(dir, { now, opPermissionLevel: config.opPermissionLevel }).load();
  return { config, report: [...(problem ? [problem] : []), ...report, ...admin.report], admin, propertiesFound: text !== null };
}
