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

export const ADMIN_COMMANDS = { op: 3, deop: 3, kick: 2, ban: 3, 'ban-ip': 3, pardon: 3, 'pardon-ip': 3, banlist: 3, whitelist: 3, stop: 4, 'save-all': 4, 'save-on': 4, 'save-off': 4, setidletimeout: 3 };
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

const red = (c) => { c.style.color = 'red'; return c; };
const grayItalic = (c) => { c.style.color = 'gray'; c.style.italic = true; return c; };
class Fail extends Error { constructor(key, ...args) { super(key); this.key = key; this.args = args; } }

export class ServerAdmin {
  constructor(saved = {}, { opLevel = DEFAULT_OP_LEVEL, whitelist = false, now = () => Date.now() } = {}) {
    this.now = now;
    this.opLevel = Number.isInteger(opLevel) && opLevel >= 1 && opLevel <= 4 ? opLevel : DEFAULT_OP_LEVEL;
    const keyed = (rows) => new Map((Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.uuid === 'string').map((r) => [r.uuid, { ...r }]));
    this.ops = keyed(saved.ops); this.bans = keyed(saved.banned); this.allow = keyed(saved.whitelist);
    this.ipBans = new Map((Array.isArray(saved.bannedIps) ? saved.bannedIps : []).filter((r) => r && typeof r.ip === 'string').map((r) => [r.ip, { ...r }]));
    this.profiles = new Map((Array.isArray(saved.profiles) ? saved.profiles : []).filter((r) => r && typeof r.uuid === 'string' && typeof r.name === 'string').map((r) => [r.name.toLowerCase(), { uuid: r.uuid, name: r.name }]));
    this.whitelistOn = typeof saved.whitelistOn === 'boolean' ? saved.whitelistOn : whitelist === true; // white-list property
    this.idleMinutes = Number.isInteger(saved.idleMinutes) && saved.idleMinutes >= 0 ? saved.idleMinutes : 0; // player-idle-timeout
    this.autosave = true; // /save-off: runtime only, as WorldServer.levelSaving
    this.directory = null; // (name) => { uuid, name } | null: accounts the server knows but that never joined (the usercache's role)
    this.host = null; // { kick(id, reason), ipOf(id), stop(), save() } set by server/server.js
    this.pending = null; this.lastAction = new Map(); this.looks = new Map();
  }
  /** The server's save data, in the shapes of ops.json, banned-players.json, banned-ips.json, whitelist.json and usercache.json. */
  save() {
    const rows = (m) => [...m.values()].map((r) => ({ ...r }));
    return { version: 1, ops: rows(this.ops), banned: rows(this.bans), bannedIps: rows(this.ipBans), whitelist: rows(this.allow), whitelistOn: this.whitelistOn, idleMinutes: this.idleMinutes, profiles: [...this.profiles.values()].map((p) => ({ ...p })) };
  }
  // PlayerProfileCache: a player who joined is known by name; /op, /ban and /whitelist add only known names.
  seen(uuid, name) { this.profiles.set(String(name).toLowerCase(), { uuid, name }); }
  profile(name) { return this.profiles.get(String(name).toLowerCase()) ?? this.directory?.(name) ?? null; }
  /** An entry past its expiry is removed on lookup (UserList.func_152683_b). */
  live(map, key) {
    const e = map.get(key); if (!e) return null;
    const until = e.expires && e.expires !== 'forever' ? parseBanDate(e.expires) : null;
    if (until && until.getTime() <= this.now()) { map.delete(key); return null; }
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
  join(id, tick) { this.lastAction.set(id, tick); this.looks.delete(id); }
  leave(id) { this.lastAction.delete(id); this.looks.delete(id); }
  /** Marks a client message as player activity: anything but input, and input that presses a key or turns the view. */
  activity(id, message, tick) {
    if (message.type === 'input') {
      const c = message.controls ?? {}, look = `${message.yaw}|${message.pitch}`, was = this.looks.get(id);
      this.looks.set(id, look);
      if (!(c.forward || c.strafe || c.jump || c.sneak || c.sprint) && (was === undefined || was === look)) return;
    }
    this.lastAction.set(id, tick);
  }
  /** Ids to kick for idling: the timeout is in minutes of game time (20 ticks a second). */
  idle(tick) {
    if (!this.idleMinutes) return [];
    return [...this.lastAction].filter(([, at]) => (tick - at) * 50 > this.idleMinutes * 60000).map(([id]) => id);
  }

  handles(line) { const w = String(line).trim().replace(/^\//, '').split(' ')[0]; return Object.hasOwn(ADMIN_COMMANDS, w); }

  /**
   * Runs one admin command line for `ctx`: { sender, level, deliver(name, component), ops(): online op names, online(): [{ id, name, uuid }] }.
   * Failures print the command's red translation, as CommandHandler.func_71556_a.
   */
  run(line, ctx) {
    let parts = String(line).trim().replace(/^\//, '').split(' ');
    while (parts.length && parts[parts.length - 1] === '') parts.pop(); // String.split drops trailing empty strings
    const word = parts.shift(), args = parts, need = ADMIN_COMMANDS[word];
    const print = (c) => ctx.deliver(ctx.sender, c);
    // CommandBase.func_152373_a: the sender's line, and chat.type.admin (gray italic) to every other op.
    const feedback = (key, ...a) => {
      const c = translation(key, ...a); print(c);
      for (const o of ctx.ops()) if (o !== ctx.sender) ctx.deliver(o, grayItalic(translation('chat.type.admin', ctx.sender, c)));
    };
    try {
      if (!(ctx.level >= need)) throw new Fail('commands.generic.permission');
      this.dispatch(word, args, { ...ctx, feedback, print });
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      print(red(translation(e.key, ...e.args)));
    }
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
        const e = [...this.ops.values()].find((o) => o.name.toLowerCase() === a[0].toLowerCase()); // UserListOps.func_152700_a: by name among the ops
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
        const e = [...this.bans.values()].find((b) => b.name.toLowerCase() === a[0].toLowerCase());
        if (!e) throw new Fail('commands.unban.failed', a[0]);
        this.bans.delete(e.uuid);
        return ctx.feedback('commands.unban.success', a[0]);
      }
      case 'ban-ip': {
        if (!(a.length >= 1 && a[0].length > 0)) throw usage('commands.banip.usage');
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
        if (!(a.length === 1 && a[0].length > 0)) throw usage('commands.unbanip.usage');
        if (!IPV4.test(a[0])) throw new Fail('commands.unbanip.invalid');
        this.ipBans.delete(a[0]); // BanList.func_152684_c removes whether or not it was banned
        return ctx.feedback('commands.unbanip.success', a[0]);
      }
      case 'banlist': {
        const ips = a.length >= 1 && a[0].toLowerCase() === 'ips';
        const names = ips ? [...this.ipBans.keys()] : [...this.bans.values()].map((b) => b.name);
        ctx.print(translation(ips ? 'commands.banlist.ips' : 'commands.banlist.players', names.length));
        return ctx.print(textComponent(joinNiceString(names)));
      }
      case 'whitelist': return this.whitelistCommand(a, ctx);
      case 'stop': ctx.feedback('commands.stop.start'); return void setImmediate(() => host?.stop());
      case 'save-all': {
        ctx.print(translation('commands.save.start')); // sender only (ac.a)
        const done = () => ctx.feedback('commands.save.success'), failed = (e) => ctx.feedback('commands.save.failed', e?.message ?? String(e));
        try { const r = host?.save(); this.pending = Promise.resolve(r).then(done, failed); } catch (e) { failed(e); }
        return;
      }
      case 'save-on':
        if (this.autosave) throw new Fail('commands.save-on.alreadyOn');
        this.autosave = true; return ctx.feedback('commands.save.enabled');
      case 'save-off':
        if (!this.autosave) throw new Fail('commands.save-off.alreadyOff');
        this.autosave = false; return ctx.feedback('commands.save.disabled');
      case 'setidletimeout': {
        if (a.length !== 1) throw usage('commands.setidletimeout.usage');
        if (!/^[+-]?\d+$/.test(a[0]) || Math.abs(Number(a[0])) > 2147483647) throw new Fail('commands.generic.num.invalid', a[0]);
        const n = Number(a[0]); if (n < 0) throw new Fail('commands.generic.num.tooSmall', n, 0);
        this.idleMinutes = n;
        return ctx.feedback('commands.setidletimeout.success', n);
      }
      default: throw new Fail('commands.generic.notFound');
    }
  }
  whitelistCommand(a, ctx) {
    if (a.length < 1) throw new Fail('commands.whitelist.usage');
    switch (a[0]) { // CommandWhitelist compares case-sensitively
      case 'on': this.whitelistOn = true; return ctx.feedback('commands.whitelist.enabled');
      case 'off': this.whitelistOn = false; return ctx.feedback('commands.whitelist.disabled');
      case 'list': {
        const names = [...this.allow.values()].map((e) => e.name);
        ctx.print(translation('commands.whitelist.list', names.length, this.profiles.size)); // second count: players the server has seen (oi.q)
        return ctx.print(textComponent(joinNiceString(names)));
      }
      case 'add': {
        if (a.length < 2) throw new Fail('commands.whitelist.add.usage');
        const p = this.profile(a[1]); if (!p) throw new Fail('commands.whitelist.add.failed', a[1]);
        this.allow.set(p.uuid, { uuid: p.uuid, name: p.name });
        return ctx.feedback('commands.whitelist.add.success', a[1]);
      }
      case 'remove': {
        if (a.length < 2) throw new Fail('commands.whitelist.remove.usage');
        const e = [...this.allow.values()].find((w) => w.name.toLowerCase() === a[1].toLowerCase());
        if (!e) throw new Fail('commands.whitelist.remove.failed', a[1]);
        this.allow.delete(e.uuid);
        return ctx.feedback('commands.whitelist.remove.success', a[1]);
      }
      case 'reload': this.reloaded = (this.reloaded ?? 0) + 1; return ctx.feedback('commands.whitelist.reloaded'); // the lists live in the save data: nothing on disk to re-read
      default: throw new Fail('commands.whitelist.usage');
    }
  }
}
