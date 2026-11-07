import { World, BLOCKS } from '../world.js';
import { PROTOCOL, serverUrl, decodeColumn, validName } from './protocol.js';

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
  async connect({ url, name, token, resumeKey }) {
    if (!validName(name)) throw new Error('Name must be 1–16 letters, numbers or underscores.');
    const ws = this.socket = new WebSocket(serverUrl(url));
    return new Promise((resolve, reject) => {
      let welcomed = false;
      const timeout = setTimeout(() => { reject(new Error('Server did not respond. Check Tailscale and the server address.')); this.close(); }, 15000);
      ws.onopen = () => this.send({ type: 'join', protocol: PROTOCOL, name, token, resumeKey });
      ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'welcome' && !welcomed) {
            if (message.protocol !== PROTOCOL) throw new Error('Server protocol differs from this game.');
            welcomed = true; clearTimeout(timeout);
            this.id = message.id; this.players = message.world.players;
            resolve(message); return;
          }
          if (message.type === 'error') throw new Error(message.text);
          if (!this.ready) {
            if (this.messages.length >= 600) throw new Error('Terrain loading took too long. Reconnect.');
            this.messages.push(message);
          } else this.apply(message);
        } catch (error) { reject(error); this.onClose(error.message); this.close(); }
      };
      ws.onclose = event => {
        clearTimeout(timeout);
        const reason = event.reason || 'Connection lost. Rejoin to continue.';
        if (!welcomed) reject(new Error(reason));
        if (!this.intentional && welcomed) this.onClose(reason);
      };
      ws.onerror = () => { if (!welcomed) reject(new Error('Could not connect. Check Tailscale, the address and server key.')); };
    });
  }
  start() { this.ready = true; for (const message of this.messages.splice(0)) this.apply(message); }
  apply(message) {
    if (message.type === 'tick' && message.tick > this.lastTick) { this.at = performance.now(); this.lastTick = message.tick; this.players = message.players; this.onTick(message); }
    if (message.type === 'chat') this.onChat(message);
  }
  send(message) { if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 65536) this.socket.send(JSON.stringify(message)); }
  close() { this.intentional = true; this.ready = false; this.socket?.close(); this.messages.length = 0; }
}
