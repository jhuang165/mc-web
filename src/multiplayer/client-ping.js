// Batch 68 mpping, client half: the keep-alive answer, the tab list's S38 pings and the server-list status ping.
// Bytecode-read (NetHandlerPlayClient bjb.a(ho)): an S38 with `online` creates the entry (ping field starts 0) and sets its ping; an S38
// without `online` removes it. bjb answers S00PacketKeepAlive at once with C00 (same id). GuiMultiplayer's pinger (bjq / bjr / bgc):
// status request, the response's description / players / version / favicon, then a ping packet; ping = now - time of the echo.
import { pingRow } from '../player-list.js';
import { STATUS_VERSION } from './server-ping.js';

export { pingRow };

export class ClientPings {
  constructor() { this.map = new Map(); }
  get(name) { return this.map.get(name) ?? 0; }
  clear() { this.map.clear(); }
  // Returns true when the message belongs to this module (it is then fully handled and needs no buffering).
  handle(message, reply) {
    if (message.type === 'pingKeepAlive') { if (Number.isInteger(message.id)) reply({ type: 'pingKeepAliveAck', id: message.id }); return true; }
    if (message.type !== 'pingList') return false;
    for (const item of Array.isArray(message.items) ? message.items : []) {
      if (!item || typeof item.name !== 'string') continue;
      if (item.online) this.map.set(item.name, Number.isFinite(item.ping) ? item.ping | 0 : 0);
      else this.map.delete(item.name);
    }
    return true;
  }
}

// bjr: players "§7online§8/§7max" (a.h GRAY, a.i DARK_GRAY); the sample becomes the tooltip lines.
export function playersText(players) {
  return players ? `§7${players.online}§8/§7${players.max}` : '§8???';
}
const DARK_RED = '§4';

// Status of one server as GuiMultiplayer holds it (ServerData): pinged=false is "Pinging...".
export function newStatus() { return { pinged: false, motd: 'Pinging...', players: '', version: '', protocol: STATUS_VERSION.protocol, ping: -1, tooltip: null, icon: null }; }

// bgc row rules. Returns the sprite row, the right-hand text and the hover text.
export function rowState(s) {
  if (!s.pinged) return { pinging: true, row: 0, rightText: s.players, hover: null, label: 'Pinging...' };
  const outdated = s.protocol !== STATUS_VERSION.protocol;
  if (outdated) return { pinging: false, row: 5, rightText: DARK_RED + s.version, hover: s.tooltip, label: s.protocol > STATUS_VERSION.protocol ? 'Client out of date!' : 'Server out of date!' };
  if (s.ping < 0) return { pinging: false, row: 5, rightText: s.players, hover: null, label: '(no connection)' };
  return { pinging: false, row: pingRow(s.ping), rightText: s.players, hover: s.tooltip, label: `${s.ping}ms` };
}

// bgc: while pinging the sprite cycles `((time / 100 + index * 2) & 7)`, folded to 8 - n above 4, from the second column (u 10).
export function pingAnimationRow(timeMs, index) {
  let n = (Math.trunc(timeMs / 100) + index * 2) & 7;
  if (n > 4) n = 8 - n;
  return n;
}

// Ask a server for its status. `open(url)` returns a WebSocket-like object (default: the browser's). Resolves a ServerData-like status;
// failures become "§4Can't connect to server." with ping -1 (bgd).
export function pingServer(url, { open = u => new WebSocket(u), now = () => Date.now(), timeout = 10000 } = {}) {
  return new Promise(resolve => {
    const status = newStatus(); let ws = null, done = false, timer = null;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); try { ws?.close(); } catch { /* closing a dead socket */ } resolve(status); };
    const fail = () => { if (done) return; status.pinged = true; status.motd = `${DARK_RED}Can't connect to server.`; status.ping = -1; status.players = ''; finish(); };
    try { ws = open(url); } catch { return fail(); }
    timer = setTimeout(fail, timeout);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'pingStatus' }));
    ws.onerror = fail;
    ws.onclose = fail; // a no-op once the probe answered
    ws.onmessage = event => {
      let m; try { m = JSON.parse(event.data); } catch { return fail(); }
      if (m.type === 'pingStatusReply') {
        status.motd = typeof m.description === 'string' ? m.description : '';
        status.version = m.version?.name ?? 'Old'; status.protocol = m.version?.protocol ?? 0;
        status.players = playersText(m.players);
        status.tooltip = Array.isArray(m.players?.sample) && m.players.sample.length ? m.players.sample.map(String) : null;
        status.icon = typeof m.favicon === 'string' ? m.favicon : null;
        ws.send(JSON.stringify({ type: 'pingProbe', time: now() }));
      } else if (m.type === 'pingProbeReply' && Number.isFinite(m.time)) {
        status.ping = Math.max(0, now() - m.time); status.pinged = true; finish();
      }
    };
  });
}
