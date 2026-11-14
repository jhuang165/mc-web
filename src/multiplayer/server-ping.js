// Batch 68 mpping, server half: keep-alive latency, the tab list's S38PacketPlayerListItem pings and the status answer.
// Bytecode-read from the unchanged 1.7.10 jar (see .shared-memory/notes/mpping-b68-track.md):
//   NetHandlerPlayServer (nh).a(): every game tick `e++`; when `e - k > 40` it sets `k = e`, `i = nanoTime / 1e6`, `h = (int) i`
//   and sends S00PacketKeepAlive(h). nh.a(C00PacketKeepAlive jc): when the id equals `h`,
//   `elapsed = (int)(nanoTime / 1e6 - i); player.ping = (player.ping * 3 + elapsed) / 4` (int division; the first value is 0).
//   ServerConfigurationManager (oi): on login S38(name, true, 1000) goes to the players already on, then S38(name, true, ping) of every
//   player (the new one included) to the new player; on logout S38(name, false, 0) to everyone; every tick `t = (t + 1 > 600) ? 0 : t + 1`
//   and, when `t < playerCount`, S38 for player `t` with its current ping goes to everyone (each player once per 601 ticks).
// Wire messages (this repo's WebSocket protocol, JSON): server to client `pingKeepAlive {id}` and `pingList {items:[{name, online, ping}]}`,
// `pingStatusReply {...}`, `pingProbeReply {time}`; client to server `pingKeepAliveAck {id}`, `pingStatus {}`, `pingProbe {time}`.

export const KEEPALIVE_TICKS = 40; // nh.a(): `e - k > 40`
export const LIST_CYCLE = 600; // oi.e(): the counter wraps past 600
export const JOIN_PING = 1000; // oi.c(): the S38 broadcast of a joining player
export const DEFAULT_MOTD = 'A Minecraft Server'; // the server.properties default (recalled)
export const STATUS_VERSION = Object.freeze({ name: '1.7.10', protocol: 5 }); // ServerStatusResponse.Version of the 1.7.10 server (protocol 5)
export const SAMPLE_LIMIT = 12; // MinecraftServer: the player sample holds at most 12 profiles (recalled)

// One connection's keep-alive state (NetHandlerPlayServer fields e, k, h, i and the player's ping).
export class KeepAlive {
  constructor(now = () => Date.now()) {
    this.now = now; this.ticks = 0; this.last = 0; this.id = 0; this.sentAt = 0; this.ping = 0;
  }
  // Called once per game tick; returns the id to send in S00 or null.
  tick() {
    this.ticks++;
    if (this.ticks - this.last <= KEEPALIVE_TICKS) return null;
    this.last = this.ticks;
    this.sentAt = this.now();
    this.id = Math.trunc(this.sentAt) | 0; // (int) of the millisecond clock
    return this.id;
  }
  // C00: only the id of the last S00 counts; the ping is the 3:1 running average with integer division.
  ack(id) {
    if (id !== this.id) return false;
    const elapsed = (this.now() - this.sentAt) | 0;
    this.ping = Math.trunc((this.ping * 3 + elapsed) / 4);
    return true;
  }
}

export const listItem = (name, online, ping) => ({ name, online: !!online, ping: online ? ping | 0 : 0 });

// All connections' keep-alives plus the tab list's S38 cadence. `send(id, message)` delivers to one player.
export class ServerPings {
  constructor({ send, now = () => Date.now() }) {
    this.send = send; this.now = now; this.conns = new Map(); this.cycle = 0;
  }
  ping(id) { return this.conns.get(id)?.ka.ping ?? 0; }
  // ServerConfigurationManager.playerLoggedIn after the player joined the connection list.
  join(id, name) {
    const joining = listItem(name, true, JOIN_PING);
    for (const other of this.conns.keys()) this.send(other, { type: 'pingList', items: [joining] });
    this.conns.set(id, { name, ka: new KeepAlive(this.now) });
    this.send(id, { type: 'pingList', items: [...this.conns.values()].map(c => listItem(c.name, true, c.ka.ping)) });
  }
  leave(id) {
    const c = this.conns.get(id);
    if (!c) return;
    this.conns.delete(id);
    for (const other of this.conns.keys()) this.send(other, { type: 'pingList', items: [listItem(c.name, false, 0)] });
  }
  ack(id, kid) { return Number.isInteger(kid) && !!this.conns.get(id)?.ka.ack(kid); }
  // One game tick: the keep-alives, then the staggered list update.
  tick() {
    for (const [id, c] of this.conns) { const kid = c.ka.tick(); if (kid !== null) this.send(id, { type: 'pingKeepAlive', id: kid }); }
    if (++this.cycle > LIST_CYCLE) this.cycle = 0;
    const entries = [...this.conns.values()];
    if (this.cycle < entries.length) {
      const c = entries[this.cycle], item = listItem(c.name, true, c.ka.ping);
      for (const id of this.conns.keys()) this.send(id, { type: 'pingList', items: [item] });
    }
  }
}

// The status answer (ServerStatusResponse): description, players {max, online, sample}, version {name, protocol}, favicon (a
// `data:image/png;base64,...` string of a 64x64 icon, or absent).
export function statusReply({ motd = DEFAULT_MOTD, online = 0, max = 20, names = [], favicon = null } = {}) {
  const reply = { type: 'pingStatusReply', description: String(motd), players: { max, online, sample: names.slice(0, SAMPLE_LIMIT).map(String) }, version: { ...STATUS_VERSION } };
  if (typeof favicon === 'string' && favicon.startsWith('data:image/png;base64,')) reply.favicon = favicon;
  return reply;
}

// Pre-login status requests (NetHandlerStatusServer: C00 request -> S00 response, C01 ping(time) -> S01 echo). Returns true when handled.
export function handleStatus(message, reply, info) {
  if (message.type === 'pingStatus') { reply(statusReply(info())); return true; }
  if (message.type === 'pingProbe' && Number.isFinite(message.time)) { reply({ type: 'pingProbeReply', time: message.time }); return true; }
  return false;
}
