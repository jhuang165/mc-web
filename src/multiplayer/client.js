import { World, BLOCKS } from '../world.js';
import { PROTOCOL, BUILD_ID, serverUrl, decodeColumn } from './protocol.js';

export function restoreReplica(snapshot) {
  const world = new World(snapshot.seed, snapshot.biome, snapshot.generationVersion);
  if (world.streaming || snapshot.columns.length !== world.chunks.size) throw new Error('Unsupported multiplayer world');
  const seen = new Set();
  for (const packet of snapshot.columns) {
    const key = `${packet.x},${packet.z}`, column = world.chunks.get(key);
    if (!column || seen.has(key)) throw new Error('Invalid multiplayer column');
    decodeColumn(packet, column, BLOCKS.length); seen.add(key);
  }
  return world;
}

export class DedicatedClient {
  constructor({ onTick = () => {}, onChat = () => {}, onClose = () => {} } = {}) {
    Object.assign(this, { onTick, onChat, onClose, socket: null, ready: false, messages: [], players: [], intentional: false, lastTick: -1 });
  }
  // `session`: the profile session (profile.js); the server takes the account's name. `pack`: this tab's weapon-rules
  // fingerprint (fingerprint.js); a gun server refuses a join whose build or pack differs from its own.
  async connect({ url, session, pack = null, build = BUILD_ID }) {
    if (typeof session !== 'string' || !session) throw new Error('Sign in first.');
    const ws = this.socket = new WebSocket(serverUrl(url));
    return new Promise((resolve, reject) => {
      let welcomed = false;
      const timeout = setTimeout(() => { reject(new Error('Server did not respond. Check that Tailscale is connected.')); this.close(); }, 15000);
      ws.onopen = () => this.send({ type: 'join', protocol: PROTOCOL, build, pack, session });
      ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'welcome' && !welcomed) {
            if (message.protocol !== PROTOCOL) throw new Error('Server protocol differs from this game.');
            welcomed = true; clearTimeout(timeout);
            this.id = message.id; this.players = message.world.players; this.lastTick = message.world.ticks ?? -1;
            resolve(message); return;
          }
          if (message.type === 'error') throw new Error(message.text);
          if (!this.ready) this.buffer(message);
          else this.apply(message);
        } catch (error) { reject(error); this.onClose(error.message); this.close(); }
      };
      ws.onclose = event => {
        clearTimeout(timeout);
        const reason = event.reason || 'Connection lost. Rejoin to continue.';
        if (!welcomed) reject(new Error(reason));
        if (!this.intentional && welcomed) this.onClose(reason);
      };
      ws.onerror = () => { if (!welcomed) reject(new Error('Could not connect. Check that Tailscale is connected.')); };
    });
  }
  // While terrain loads, ticks merge into one: each cell keeps its last write and
  // presence/time/weather come from the newest tick, so a slow device never
  // falls behind or holds an unbounded queue. Chat keeps the latest 100 lines. A gun server's inventory and open window are sent only when
  // they change, so the newest ones are kept; its per-player events (shots, hits) are past by the time the world shows.
  buffer(message) {
    if (message.type === 'chat') { this.messages.push(message); if (this.messages.length > 100) this.messages.shift(); return; }
    if (message.type !== 'tick') return;
    const merged = this.pending ??= { cells: new Map(), sticky: {} };
    for (const change of message.changes) merged.cells.set(`${change[0]},${change[1]},${change[2]}`, change);
    for (const key of ['inv', 'open']) if (message.you && key in message.you) merged.sticky[key] = message.you[key]; // sent only on change
    merged.last = message;
  }
  start() {
    this.ready = true;
    const merged = this.pending; this.pending = null;
    if (merged) {
      const last = merged.last, you = last.you && { ...merged.sticky, ...last.you };
      this.apply({ ...last, changes: [...merged.cells.values()], events: [], ...(you ? { you } : {}) });
    }
    for (const message of this.messages.splice(0)) this.apply(message);
  }
  apply(message) {
    if (message.type === 'tick' && message.tick > this.lastTick) { this.at = performance.now(); this.lastTick = message.tick; this.players = message.players; this.onTick(message); }
    if (message.type === 'chat') this.onChat(message);
  }
  send(message) { if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 65536) this.socket.send(JSON.stringify(message)); }
  close() { this.intentional = true; this.ready = false; this.socket?.close(); this.messages.length = 0; this.pending = null; }
}
