// Batch 68 mpadmin: the 1.7.10 dedicated-server administration commands (the "dedicated" group of command-data.js) and the lists behind them.
//
// Evidence (bytecode-read from the unchanged 1.7.10 client jar, see .shared-memory/notes/mpadmin-b68-track.md):
//  * CommandOp (bc, level 3), CommandDeOp (aj), CommandBanPlayer (ag), CommandBanIp (af), CommandPardonPlayer (be), CommandPardonIp (bd), CommandListBans (ax),
//    CommandWhitelist (cc, level 3), CommandServerKick (av, level 2), CommandSaveAll (bh), CommandSaveOn (bj), CommandSaveOff (bi), CommandStop (bt, level 4),
//    CommandSetPlayerTimeout (bo): argument counts, failure keys, success keys, the kick texts.
//  * ServerConfigurationManager.func_148542_a (oi.a(SocketAddress, GameProfile)): banned player, then the whitelist (ops pass), then banned IP, then the full server.
//  * UserListOps / UserListBans / UserListWhitelist / BanList (IP): ops.json {uuid,name,level}, banned-players.json {uuid,name,created,source,expires,reason},
//    banned-ips.json {ip,created,source,expires,reason}, whitelist.json {uuid,name}; maps are keyed by profile UUID (IP string for bans); /op uses op-permission-level.
//  * op-permission-level default 4 and the white-list property default false are recalled (the dedicated server classes are not in the client jar).
// The lists are kept in the server's save data (DedicatedSimulation.save() -> `admin`), in the native file shapes; ops are keyed by the player's account UUID.
import { translation, text as textComponent } from '../chat-component.js';
import { joinNiceString } from '../commands-scoreboard.js';
import { UserMap, userListValues, userListKeys } from './user-list-order.js'; // b70 sptab70: HashMap-ordered lists; b71 mpadmin71: listings, files and the profile cache use it
import { idleActivity } from './server-idle.js'; // b74 mpmisc74: which messages reset the idle clock
import { offlineUuid } from '../stats.js'; // b86 console86: UUID.nameUUIDFromBytes("OfflinePlayer:" + name), as EntityPlayer.func_146094_a (yz.a(GameProfile))

export const ADMIN_COMMANDS = { op: 3, deop: 3, kick: 2, ban: 3, 'ban-ip': 3, pardon: 3, 'pardon-ip': 3, banlist: 3, whitelist: 3, stop: 4, 'save-all': 4, 'save-on': 4, 'save-off': 4, setidletimeout: 3, netstat: 1 }; // netstat: CommandNetstat (permission 0) is denied to non-ops by mw.a, and a player gets only a refusal line (b84 dedicated84, executed)
export const DEFAULT_OP_LEVEL = 4; // server.properties op-permission-level
// CommandBanIp.a: ^([01]?\d\d?|2[0-4]\d|25[0-5])\.(...)$
const OCTET = '([01]?\\d\\d?|2[0-4]\\d|25[0-5])';
export const IPV4 = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);
export const BAN_DEFAULT_REASON = 'Banned by an operator.'; // BanEntry.func_73686_f (nr.d) when no reason was given
export const KICK_DEFAULT_REASON = 'Kicked by an operator.';
export const KICK_BAN = 'You are banned from this server.'; // /ban on an online player
export const KICK_IP_BAN = 'You have been IP banned.';
export const KICK_IDLE = 'You have been idle for too long!'; // NetHandlerPlayServer.update
const pad = (n, w = 2) => String(n).padStart(w, '0');
/** BanEntry's SimpleDateFormat("yyyy-MM-dd HH:mm:ss Z"), in UTC. */
export const banDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`;
const parseBanDate = (s) => { const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d) ([+-])(\d\d)(\d\d)$/.exec(String(s)); if (!m) return null; const off = (m[7] === '-' ? -1 : 1) * (+m[8] * 60 + +m[9]); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - off * 60000); };
/** ServerConfigurationManager's "yyyy-MM-dd 'at' HH:mm:ss z" for the "Your ban will be removed on" line. */
const removedOn = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} at ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
/** A client address as the server keeps it: no port, no IPv4-mapped prefix (BanList.func_152707_c strips "/" and ":port"). */
export const normalizeIp = (a) => String(a ?? '').replace(/^\//, '').replace(/^::ffff:/i, '').replace(/:\d+$/, (m, i, s) => (s.includes('.') || s.indexOf(':') === i ? '' : m));

export const CONSOLE_NAME = 'Server'; // b86 console86: MinecraftServer.b_() (getCommandSenderName), the console sender's name in notices and ban sources
export const NOT_FOR_PLAYERS = 'Command is not available for players';

// b86 console86: NetworkStatistics (eu: two ex trackers, read c and write d, of 100 packet ids; ey = {totalBytes, count, averageBytes}). The netty decoder (ez) and encoder (fa)
// record every packet (id, bytes) (bytecode-read). b87 offline87: server.js records each WebSocket message under its native packet id (net-packet-ids.js).
const javaDouble = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x)); // Double.toString for the small averages (no exponent forms below 1e7)
class PacketTracker {
  constructor() { this.bytes = new Array(100).fill(0); this.counts = new Array(100).fill(0); }
  add(id, bytes) { if (!(id >= 0 && id < 100)) return; this.bytes[id] += bytes; this.counts[id]++; } // ex.a(int, long): ids outside 0..99 are dropped
  totalBytes() { return this.bytes.reduce((a, b) => a + b, 0); } // ex.a()
  totalCount() { return this.counts.reduce((a, b) => a + b, 0); } // ex.b()
  // ex.c() / ex.d(): the first id with the largest total bytes / count, starting from a -1 sentinel (so id 0 with no traffic)
  hottest() { let at = -1, best = -1; for (let i = 0; i < 100; i++) if (this.bytes[i] > best) { best = this.bytes[i]; at = i; } return at; }
  most() { let at = -1, best = -1; for (let i = 0; i < 100; i++) if (this.counts[i] > best) { best = this.counts[i]; at = i; } return at; }
  stat(id) { const n = this.counts[id], b = this.bytes[id]; return `PacketStat(${id}){totalBytes=${b}, count=${n}, averageBytes=${javaDouble(n ? b / n : 0)}}`; } // ew.toString + ey.toString
}
export class NetStats { constructor() { this.reads = new PacketTracker(); this.writes = new PacketTracker(); } read(id, bytes) { this.reads.add(id, bytes); } write(id, bytes) { this.writes.add(id, bytes); } }

const red = (c) => { c.style.color = 'red'; return c; };
const grayItalic = (c) => { c.style.color = 'gray'; c.style.italic = true; return c; };
class Fail extends Error { constructor(key, ...args) { super(key); this.key = key; this.args = args; } }

export class ServerAdmin {
  constructor(saved = {}, { opLevel = DEFAULT_OP_LEVEL, whitelist = false, onlineMode = true, now = () => Date.now(), clock = () => Math.floor(performance.now()) } = {}) {
    this.now = now; this.clock = clock; // b75 mpplayerfx75: `clock` = MinecraftServer.getSystemTimeMillis (System.nanoTime() / 1000000, monotonic), the idle timer's time base
    this.onlineMode = onlineMode !== false; // b86 console86: server.properties online-mode (MinecraftServer.Y()); off, an unknown name resolves to its offline profile (profile())
    this.netStats = new NetStats(); // b86 console86: what /netstat reports to the console
    this.opLevel = Number.isInteger(opLevel) && opLevel >= 1 && opLevel <= 4 ? opLevel : DEFAULT_OP_LEVEL;
    const keyed = (rows) => new UserMap((Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.uuid === 'string').map((r) => [r.uuid, { ...r }]));
    this.ops = keyed(saved.ops); this.bans = keyed(saved.banned); this.allow = keyed(saved.whitelist);
    this.ipBans = new UserMap((Array.isArray(saved.bannedIps) ? saved.bannedIps : []).filter((r) => r && typeof r.ip === 'string').map((r) => [r.ip, { ...r }]));
    // b71 mpadmin71: PlayerProfileCache (ns) keeps `HashMap<lowercase name, entry>` (bytecode-read); its tab names (ns.func_152654_a) are that map's keySet, so a UserMap
    this.profiles = new UserMap((Array.isArray(saved.profiles) ? saved.profiles : []).filter((r) => r && typeof r.uuid === 'string' && typeof r.name === 'string').map((r) => [r.name.toLowerCase(), { uuid: r.uuid, name: r.name }]));
    this.whitelistOn = typeof saved.whitelistOn === 'boolean' ? saved.whitelistOn : whitelist === true; // white-list property
    this.idleMinutes = Number.isInteger(saved.idleMinutes) && saved.idleMinutes >= 0 ? saved.idleMinutes : 0; // player-idle-timeout
    // b87 offline87: one levelSaving flag (mt.c, true = saving off) per WorldServer, as MinecraftServer.c[] (Overworld, Nether, End). /save-off and /save-on set every flag
    // and report a change when any flag changed (bytecode-read bi.b / bj.b; executed in the "partial" rows); runtime only. The port writes one save file, so the
    // periodic and the shutdown saves follow the Overworld's flag (`autosave`); the commands only ever switch all three together.
    this.levelSaving = [false, false, false];
    this.whitelistFile = null; // b70 sptab70: { read(): rows | null, write(rows) } for whitelist.json beside server.properties (set by server/server.js)
    this.listFiles = null; // b71 mpadmin71: { read(name) -> rows | null, write(name, rows) } for ops, whitelist, banned-players and banned-ips (.json beside server.properties; set by server/server.js)
    this.written = new Map(); // list name -> the text last written to (or read from) its file
    this.directory = null; // (name) => { uuid, name } | null: accounts the server knows but that never joined (the usercache's role)
    this.savedCount = null; // () => number of stored player files (set by the simulation)
    this.host = null; // { kick(id, reason), ipOf(id), stop(), save() } set by server/server.js
    this.pending = null; this.lastAction = new Map(); this.looks = new Map();
  }
  get autosave() { return !this.levelSaving[0]; } // /save-off: runtime only
  set autosave(on) { this.levelSaving.fill(!on); }
  // b87 offline87: the profile a login gets (NetHandlerLoginServer.func_147326_c; executed func_152506_a in offline87-reference.json). Online mode: the authenticated
  // profile (the port's account id stands for the Mojang UUID). Offline mode (online-mode=false): an incomplete profile becomes (UUID.nameUUIDFromBytes("OfflinePlayer:" +
  // typed name), typed name), the name's case kept. EntityPlayer.func_146094_a makes that the entity UUID, the key of playerdata/<uuid>.dat, the stats file and
  // the list entries; the port keys the saved player, the tamed owners, /list uuids and the four lists by it (the player's resumeKey).
  loginProfile({ id, name }) { return this.onlineMode ? { uuid: id, name } : { uuid: offlineUuid(name), name }; }
  /** The server's save data, in the shapes of ops.json, banned-players.json, banned-ips.json, whitelist.json and usercache.json. */
  save() {
    const rows = (m) => userListValues(m).map((r) => ({ ...r })); // b71 mpadmin71: UserList.saveToFile writes values() = HashMap order
    return { version: 1, ops: rows(this.ops), banned: rows(this.bans), bannedIps: rows(this.ipBans), whitelist: rows(this.allow), whitelistOn: this.whitelistOn, idleMinutes: this.idleMinutes, profiles: [...this.profiles.values()].map((p) => ({ ...p })) };
  }
  // PlayerProfileCache: a player who joined is known by name; /op, /ban and /whitelist add only known names.
  // ns.func_152651_a(profile, date): an entry already known by uuid has its old name key removed, then the name is put again (it lands last in its bucket)
  seen(uuid, name) {
    for (const [k, v] of this.profiles) if (v.uuid === uuid) this.profiles.delete(k);
    this.profiles.set(String(name).toLowerCase(), { uuid, name });
  }
  /** ns.func_152654_a: the lowercase names, in HashMap order (the /whitelist add completion). */
  profileNames() { return userListKeys(this.profiles); }
  // ns.func_152655_a (a(String)): a cache miss asks the profile repository and, on a hit, adds the profile to the cache (b84 dedicated84: executed, the name joins the usercache and the tab names).
  // b86 console86 (bytecode-read ns.a(String) and ns.a(MinecraftServer, String), executed in the offline rows): the name is lowercased (Locale.ROOT) before the cache and the
  // repository see it; when the repository misses and the server is not in online mode, the profile is (UUID.nameUUIDFromBytes("OfflinePlayer:" + lowercased name), lowercased name).
  // Only /op, /ban and /whitelist add resolve profiles; /deop, /pardon and /whitelist remove match the list entries by name, /ban-ip and /kick online players.
  profile(name) {
    const lower = String(name).toLowerCase();
    const hit = this.profiles.get(lower); if (hit) return hit;
    const known = this.directory?.(lower) ?? (this.onlineMode ? null : { uuid: offlineUuid(lower), name: lower }); if (!known) return null;
    this.seen(known.uuid, known.name); return this.profiles.get(String(known.name).toLowerCase());
  }
  /** An entry past its expiry is removed on lookup (UserList.func_152683_b). */
  live(map, key) {
    const e = map.get(key); if (!e) return null;
    const until = e.expires && e.expires !== 'forever' ? parseBanDate(e.expires) : null;
    if (until && until.getTime() <= this.now()) { map.delete(key); this.flush(); return null; }
    return e;
  }
  /** The op entry's level of a player name (a name that joined once), or null when not an op. */
  levelOfName(name) { const p = this.profiles.get(String(name).toLowerCase()); const e = p && this.ops.get(p.uuid); return e ? (Number.isInteger(e.level) ? e.level : this.opLevel) : null; }
  isOpName(name) { return this.levelOfName(name) !== null; }
  /**
   * ServerConfigurationManager.func_148542_a: the reason text a login is refused with, or null. Order: banned player, whitelist (ops pass), banned IP.
   * `op` is true for a player the server treats as an operator by another route (the MC_WEB_OPS names).
   */
  refusal({ uuid, name }, ip, { op = false } = {}) {
    const b = this.live(this.bans, uuid);
    if (b) return `You are banned from this server!\nReason: ${b.reason || BAN_DEFAULT_REASON}` + (b.expires && b.expires !== 'forever' ? `\nYour ban will be removed on ${removedOn(parseBanDate(b.expires))}` : '');
    if (this.whitelistOn && !op && !this.ops.has(uuid) && !this.live(this.allow, uuid)) return 'You are not white-listed on this server!';
    const key = normalizeIp(ip), i = key ? this.live(this.ipBans, key) : null;
    if (i) return `Your IP address is banned from this server!\nReason: ${i.reason || BAN_DEFAULT_REASON}` + (i.expires && i.expires !== 'forever' ? `\nYour ban will be removed on ${removedOn(parseBanDate(i.expires))}` : '');
    return null;
  }
  // ---- idle timeout (/setidletimeout, NetHandlerPlayServer.update): minutes without an action; 0 is off ----
  // b75 mpplayerfx75: wall-clock milliseconds, not ticks (bytecode-read nh.update: `MinecraftServer.getSystemTimeMillis() - player.x() > minutes * 1000 * 60`, only while x() > 0;
  // x() is set to getSystemTimeMillis when the EntityPlayerMP is created and by each activity packet). A lagging server therefore kicks on real time.
  join(id, at = this.clock()) { this.lastAction.set(id, at); this.looks.delete(id); }
  leave(id) { this.lastAction.delete(id); this.looks.delete(id); }
  /** Marks a client message as player activity: only the packets that call EntityPlayerMP.func_143004_u's setter count (server-idle.js). */
  activity(id, message, at = this.clock(), chatAllowed = true) {
    const { reset, state } = idleActivity(message, this.looks.get(id), chatAllowed); // b74 mpmisc74: `looks` holds the input state now
    if (state !== undefined) this.looks.set(id, state);
    if (reset) this.lastAction.set(id, at);
  }
  /** Ids to kick for idling: more than the timeout's minutes of wall-clock time (`now` in ms, default the injected clock) since the last activity. */
  idle(now = this.clock()) {
    if (!this.idleMinutes) return [];
    return [...this.lastAction].filter(([, at]) => at > 0 && now - at > this.idleMinutes * 1000 * 60).map(([id]) => id);
  }

  handles(line) { const w = String(line).trim().replace(/^\//, '').split(' ')[0]; return Object.hasOwn(ADMIN_COMMANDS, w); }

  /**
   * Runs one admin command line for `ctx`: { sender, level, deliver(name, component), ops(): online op names, online(): [{ id, name, uuid }] }.
   * b86 console86: `console: true` runs it as the DedicatedServer sender (name "Server", every level: MinecraftServer.a(int, String) returns true), whose own lines go to `log`;
   * `log(component)` is the server log (MinecraftServer.a(fj) logs fj.c(), the unformatted text), which also gets every other sender's admin notice.
   * Failures print the command's red translation, as CommandHandler.func_71556_a.
   */
  run(line, ctx) {
    let parts = String(line).trim().replace(/^\//, '').split(' ');
    while (parts.length && parts[parts.length - 1] === '') parts.pop(); // String.split drops trailing empty strings
    const word = parts.shift(), args = parts, need = ADMIN_COMMANDS[word];
    const print = ctx.console ? (c) => ctx.log?.(c) : (c) => ctx.deliver(ctx.sender, c);
    // CommandBase.func_152373_a: the sender's line, and chat.type.admin (gray italic) to every other op whose level reaches the command's (b85 dedtab85, executed),
    // then (b86 console86, executed) the same notice to the server log unless the sender is the server itself.
    const feedback = (key, ...a) => {
      const c = translation(key, ...a); print(c);
      const notice = () => grayItalic(translation('chat.type.admin', ctx.sender, translation(key, ...a)));
      for (const o of ctx.ops(need)) if (ctx.console || o !== ctx.sender) ctx.deliver(o, notice());
      if (!ctx.console) ctx.log?.(notice());
    };
    try {
      if (!(ctx.level >= need)) throw new Fail('commands.generic.permission');
      this.dispatch(word, args, { ...ctx, feedback, print });
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      print(red(translation(e.key, ...e.args)));
    } finally { this.flush(); } // b71 mpadmin71: UserList writes its file after every add and remove
  }
  online(ctx, name) { return ctx.online().find((p) => p.name.toLowerCase() === String(name).toLowerCase()) ?? null; } // ServerConfigurationManager.func_152612_a
  dispatch(word, a, ctx) {
    const usage = (key) => new Fail(key), host = this.host;
    const reasonFrom = (n) => (a.length > n ? a.slice(n).join(' ') : null); // CommandBase.func_147178_a joins the rest
    const kick = (p, reason) => host?.kick(p.id, reason);
    switch (word) {
      case 'op': {
        if (!(a.length === 1 && a[0].length > 0)) throw usage('commands.op.usage');
        const p = this.profile(a[0]); if (!p) throw new Fail('commands.op.failed', a[0]);
        this.ops.set(p.uuid, { uuid: p.uuid, name: p.name, level: this.opLevel }); // UserListOpsEntry(profile, op-permission-level)
        return ctx.feedback('commands.op.success', a[0]);
      }
      case 'deop': {
        if (!(a.length === 1 && a[0].length > 0)) throw usage('commands.deop.usage');
        const e = userListValues(this.ops).find((o) => o.name.toLowerCase() === a[0].toLowerCase()); // UserListOps.func_152700_a: by name among the ops
        if (!e) throw new Fail('commands.deop.failed', a[0]);
        this.ops.delete(e.uuid);
        return ctx.feedback('commands.deop.success', a[0]);
      }
      case 'kick': {
        if (!(a.length > 0 && a[0].length > 1)) throw usage('commands.kick.usage');
        const p = this.online(ctx, a[0]); if (!p) throw new Fail('commands.generic.player.notFound');
        const reason = a.length >= 2 ? reasonFrom(1) : KICK_DEFAULT_REASON;
        kick(p, reason);
        return a.length >= 2 ? ctx.feedback('commands.kick.success.reason', p.name, reason) : ctx.feedback('commands.kick.success', p.name);
      }
      case 'ban': {
        if (!(a.length >= 1 && a[0].length > 0)) throw usage('commands.ban.usage');
        const p = this.profile(a[0]); if (!p) throw new Fail('commands.ban.failed', a[0]);
        this.bans.set(p.uuid, { uuid: p.uuid, name: p.name, created: banDate(new Date(this.now())), source: ctx.sender, expires: 'forever', reason: reasonFrom(1) ?? BAN_DEFAULT_REASON });
        const on = this.online(ctx, a[0]); if (on) kick(on, KICK_BAN);
        return ctx.feedback('commands.ban.success', a[0]);
      }
      case 'pardon': {
        if (!(a.length === 1 && a[0].length > 0)) throw usage('commands.unban.usage');
        const e = userListValues(this.bans).find((b) => b.name.toLowerCase() === a[0].toLowerCase());
        if (!e) throw new Fail('commands.unban.failed', a[0]);
        this.bans.delete(e.uuid);
        return ctx.feedback('commands.unban.success', a[0]);
      }
      case 'ban-ip': {
        if (!(a.length >= 1 && a[0].length > 1)) throw usage('commands.banip.usage'); // CommandBanIp: args[0].length() > 1 (executed: /ban-ip x is the usage line)
        const reason = reasonFrom(1);
        let ip = a[0];
        if (!IPV4.test(ip)) { // a player that is online: that player's address
          const p = this.online(ctx, a[0]); const addr = p && host?.ipOf(p.id);
          if (!addr) throw new Fail('commands.banip.invalid');
          ip = normalizeIp(addr);
        }
        this.ipBans.set(ip, { ip, created: banDate(new Date(this.now())), source: ctx.sender, expires: 'forever', reason: reason ?? BAN_DEFAULT_REASON });
        const hit = ctx.online().filter((p) => normalizeIp(host?.ipOf(p.id)) === ip);
        for (const p of hit) kick(p, KICK_IP_BAN);
        return hit.length ? ctx.feedback('commands.banip.success.players', ip, joinNiceString(hit.map((p) => p.name))) : ctx.feedback('commands.banip.success', ip);
      }
      case 'pardon-ip': {
        if (!(a.length === 1 && a[0].length > 1)) throw usage('commands.unbanip.usage'); // CommandPardonIp: length() > 1 too
        if (!IPV4.test(a[0])) throw new Fail('commands.unbanip.invalid');
        this.ipBans.delete(a[0]); // BanList.func_152684_c removes whether or not it was banned
        return ctx.feedback('commands.unbanip.success', a[0]);
      }
      case 'banlist': {
        const ips = a.length >= 1 && a[0].toLowerCase() === 'ips';
        const names = ips ? userListKeys(this.ipBans) : userListValues(this.bans).map((b) => b.name); // b71 mpadmin71: nx.a() = keySet().toArray, op.a() = values() names: HashMap order (bytecode-read, CommandServerBanlist ax)
        ctx.print(translation(ips ? 'commands.banlist.ips' : 'commands.banlist.players', names.length));
        return ctx.print(textComponent(joinNiceString(names)));
      }
      case 'whitelist': return this.whitelistCommand(a, ctx);
      case 'netstat': return this.netstat(a, ctx);
      case 'stop': ctx.feedback('commands.stop.start'); return void setImmediate(() => host?.stop());
      case 'save-all': {
        ctx.print(translation('commands.save.start')); // sender only (ac.a)
        if (a.length > 0 && a[0] === 'flush') { ctx.print(translation('commands.save.flushStart')); ctx.print(translation('commands.save.flushEnd')); } // case-sensitive; the lang file has no such keys, so the raw keys show (bytecode-read + executed)
        const done = () => ctx.feedback('commands.save.success'), failed = (e) => ctx.feedback('commands.save.failed', e?.message ?? String(e));
        try { const r = host?.save(); this.pending = Promise.resolve(r).then(done, failed); } catch (e) { failed(e); }
        return;
      }
      case 'save-on': { // bj.b: every world with levelSaving set is cleared; "already on" only when none was
        let changed = false; this.levelSaving.forEach((off, i) => { if (off) { this.levelSaving[i] = false; changed = true; } });
        if (!changed) throw new Fail('commands.save-on.alreadyOn');
        return ctx.feedback('commands.save.enabled');
      }
      case 'save-off': { // bi.b: every world without levelSaving gets it; "already off" only when none changed
        let changed = false; this.levelSaving.forEach((off, i) => { if (!off) { this.levelSaving[i] = true; changed = true; } });
        if (!changed) throw new Fail('commands.save-off.alreadyOff');
        return ctx.feedback('commands.save.disabled');
      }
      case 'setidletimeout': {
        if (a.length !== 1) throw usage('commands.setidletimeout.usage');
        if (!/^[+-]?\d+$/.test(a[0]) || Math.abs(Number(a[0])) > 2147483647) throw new Fail('commands.generic.num.invalid', a[0]);
        const n = Number(a[0]); if (n < 0) throw new Fail('commands.generic.num.tooSmall', n, 0);
        this.idleMinutes = n; this.onIdleTimeout?.(n); // b70 serverprops2: DedicatedServer.func_143006_e also writes player-idle-timeout to server.properties (server.js sets the hook)
        return ctx.feedback('commands.setidletimeout.success', n);
      }
      default: throw new Fail('commands.generic.notFound');
    }
  }
  // CommandNetstat (bb.b, bytecode-read; b86 console86: every branch executed from the console): a player gets one raw line; the console gets the NetworkStatistics texts.
  netstat(a, ctx) {
    const say = (t) => ctx.print(textComponent(t)), s = this.netStats;
    if (!ctx.console) return say(NOT_FOR_PLAYERS); // `instanceof yz` (EntityPlayer); a raw ChatComponentText, not red, not translated
    if (!(a.length > 0 && a[0].length > 1)) return say(`reads: ${s.reads.totalBytes()}, writes: ${s.writes.totalBytes()}`);
    const packet = (tracker) => {
      if (!(a.length > 1 && a[1].length > 0)) return say('Packet id is missing');
      const t = a[1].trim();
      if (!/^[+-]?\d+$/.test(t) || Math.abs(Number(t)) > 2147483647) return say(`Packet ${a[1]} not found!`); // NumberFormatException
      const id = Number(t); return say(id >= 0 && id < 100 ? tracker.stat(id) : `Packet ${id} not found!`); // ex.a(int) is null outside 0..99
    };
    switch (a[0]) { // String.equals: case-sensitive
      case 'hottest-read': return say(s.reads.stat(s.reads.hottest()));
      case 'hottest-write': return say(s.writes.stat(s.writes.hottest()));
      case 'most-read': return say(s.reads.stat(s.reads.most()));
      case 'most-write': return say(s.writes.stat(s.writes.most()));
      case 'packet-read': return packet(s.reads);
      case 'packet-write': return packet(s.writes);
      case 'read-count': return say(`total-read-count${s.reads.totalCount()}`);
      case 'write-count': return say(`total-write-count${s.writes.totalCount()}`);
      default: return say(`Unrecognized: ${a[0]}`);
    }
  }
  whitelistCommand(a, ctx) {
    if (a.length < 1) throw new Fail('commands.whitelist.usage');
    switch (a[0]) { // CommandWhitelist compares case-sensitively
      case 'on': this.whitelistOn = true; return ctx.feedback('commands.whitelist.enabled');
      case 'off': this.whitelistOn = false; return ctx.feedback('commands.whitelist.disabled');
      case 'list': {
        const names = userListValues(this.allow).map((e) => e.name); // b71 mpadmin71: oi.l() = or.a() = values() names, HashMap order
        ctx.print(translation('commands.whitelist.list', names.length, this.savedCount?.() ?? this.profiles.size)); // second count (oi.q = world 0's SaveHandler playerdata/*.dat files; b84 dedicated84, executed): players whose data was saved (a leave, an autosave or /save-all), not the profile cache
        return ctx.print(textComponent(joinNiceString(names)));
      }
      case 'add': {
        if (a.length < 2) throw new Fail('commands.whitelist.add.usage');
        const p = this.profile(a[1]); if (!p) throw new Fail('commands.whitelist.add.failed', a[1]);
        this.allow.set(p.uuid, { uuid: p.uuid, name: p.name }); this.writeWhitelist();
        return ctx.feedback('commands.whitelist.add.success', a[1]);
      }
      case 'remove': {
        if (a.length < 2) throw new Fail('commands.whitelist.remove.usage');
        const e = userListValues(this.allow).find((w) => w.name.toLowerCase() === a[1].toLowerCase());
        if (!e) throw new Fail('commands.whitelist.remove.failed', a[1]);
        this.allow.delete(e.uuid); this.writeWhitelist();
        return ctx.feedback('commands.whitelist.remove.success', a[1]);
      }
      case 'reload': this.reloadWhitelist(); return ctx.feedback('commands.whitelist.reloaded'); // oi.func_152599_k is empty in the base class (bytecode-read); the dedicated list re-reads whitelist.json (recalled)
      default: throw new Fail('commands.whitelist.usage');
    }
  }
  // ---- b71 mpadmin71: ops.json, whitelist.json, banned-players.json and banned-ips.json beside server.properties ----
  // The file wins over the save's `admin` lists at start-up (loadFiles; a missing file keeps the save's list and is created by the first flush: the one-time migration).
  // UserList.saveToFile (recalled; gson over values()) writes the HashMap order; files are replaced atomically by the hook (temp file + rename).
  /** [name, list, row filter] of the four files. */
  fileLists() {
    const named = (r) => r && typeof r.uuid === 'string' && typeof r.name === 'string';
    return [['ops', 'ops', named, 'uuid'], ['whitelist', 'allow', named, 'uuid'], ['banned-players', 'bans', (r) => r && typeof r.uuid === 'string', 'uuid'], ['banned-ips', 'ipBans', (r) => r && typeof r.ip === 'string', 'ip']];
  }
  io(name) {
    if (name === 'whitelist' && this.whitelistFile) return this.whitelistFile; // b70 hook (read(), write(rows))
    const f = this.listFiles; return f ? { read: () => f.read(name), write: (rows) => f.write(name, rows) } : null;
  }
  rowsOf(prop) { return userListValues(this[prop]).map((r) => ({ ...r })); }
  /** Reads every list file that exists; a list whose file is unreadable keeps the save's entries and its file is left alone until the list changes. Returns the names loaded. */
  loadFiles() {
    const loaded = [];
    for (const [name, prop, ok, key] of this.fileLists()) {
      const io = this.io(name); if (!io) continue;
      let rows = null, failed = false;
      try { rows = io.read() ?? null; } catch { failed = true; }
      if (failed || (rows !== null && !Array.isArray(rows))) { this.written.set(name, JSON.stringify(this.rowsOf(prop), null, 2)); continue; }
      if (rows === null) continue;
      const strip = name === 'whitelist' ? (r) => ({ uuid: r.uuid, name: r.name }) : (r) => ({ ...r });
      this[prop] = new UserMap(rows.filter(ok).map((r) => [r[key], strip(r)]));
      this.written.set(name, JSON.stringify(this.rowsOf(prop), null, 2));
      loaded.push(name);
    }
    this.flush(); // creates the missing files (migration of the save's lists) and puts loaded ones in native order
    return loaded;
  }
  /** Writes every list whose text differs from the file's last known text; a failed write is retried at the next change. */
  flush(only) {
    for (const [name, prop] of this.fileLists()) {
      if (only && only !== name) continue;
      const io = this.io(name); if (!io) continue;
      const rows = this.rowsOf(prop), text = JSON.stringify(rows, null, 2);
      if (this.written.get(name) === text) continue;
      try { io.write(rows); this.written.set(name, text); } catch { /* the save data still holds the list */ }
    }
  }
  // b70 sptab70: DedicatedPlayerList.func_152599_k re-reads the whitelist file (recalled: the UserList loader is server-only, not in the client JAR). A missing or unreadable file leaves the list as it is.
  writeWhitelist() { this.flush('whitelist'); }
  reloadWhitelist() {
    this.reloaded = (this.reloaded ?? 0) + 1;
    let rows = null; try { rows = this.io('whitelist')?.read() ?? null; } catch { rows = null; }
    if (!Array.isArray(rows)) return false;
    this.allow = new UserMap(rows.filter((r) => r && typeof r.uuid === 'string' && typeof r.name === 'string').map((r) => [r.uuid, { uuid: r.uuid, name: r.name }]));
    this.written.set('whitelist', JSON.stringify(this.rowsOf('allow'), null, 2));
    return true;
  }
}
