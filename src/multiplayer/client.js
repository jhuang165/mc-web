import { World, BLOCKS } from '../world.js';
import { ChunkProviderGenerate, BiomeTerrainState } from '../terrain-generator.js';
import { javaSeed, javaTemperature, biomeLayerOptions } from '../java-world.js';
import { PROTOCOL, BUILD_ID, serverUrl, decodeColumn } from './protocol.js';

const SPAN = 8, COLUMN = 16 * 16 * 256;
let replicaInit = null; // the snapshot ReplicaWorld's constructor is building from (World's constructor calls generate())

// A gun server's streamed (infinite) world as this tab holds it: exactly the 8 x 8 columns of the window the server last sent
// (server-world.js), never generated here. Biomes (grass and foliage colours, rain or snow) come from the same seed's
// WorldChunkManager, with the server's origin; the terrain, its population and every change come from the server.
export class ReplicaWorld extends World {
  constructor(snapshot) {
    replicaInit = snapshot;
    try { super(snapshot.seed, snapshot.biome, snapshot.generationVersion); } finally { replicaInit = null; }
    this.noPrefetch = true; // main.js startPrefetch: no generator worker
    this.chunks = new Map(); this.lastChunk = null; this.minX = this.minZ = NaN; // nothing until the server's first window
    this.serverWindow = null;
  }
  generate() {
    const s = replicaInit, seed = javaSeed(this.seed);
    if (!Number.isInteger(s?.originX) || !Number.isInteger(s?.originZ) || s.originX % 16 || s.originZ % 16) throw new Error('Unsupported multiplayer world');
    const gen = new ChunkProviderGenerate(seed, this.worldType, new BiomeTerrainState(), biomeLayerOptions(this.generationVersion)), manager = gen.manager;
    Object.assign(this, { originX: s.originX, originZ: s.originZ, javaSeed: seed, javaGenerator: gen });
    if (Array.isArray(s.nativeSpawn) && s.nativeSpawn.length === 3 && s.nativeSpawn.every(Number.isInteger)) this.nativeSpawn = [...s.nativeSpawn];
    this.biomeAt = (x, z) => manager.biomeAt(x + this.originX, z + this.originZ);
    this.temperatureAt = (x, y, z) => javaTemperature(this.biomeAt(x, z), x + this.originX, y, z + this.originZ);
  }
  // Only the server's columns: a column it did not send is air (it never is, for a valid message).
  terrainFor(cx, cz) { return this.baseColumns.get(`${cx},${cz}`) ?? { blocks: new Uint8Array(COLUMN), metadata: new Uint8Array(COLUMN) }; }
  rememberEdit() {} // a column that comes back is sent again whole
  // The window moves only when the server says so (receive), not with this tab's own position.
  streamAround() {
    const w = this.serverWindow;
    if (!w) return null;
    this.serverWindow = null;
    return super.streamAround(w.minX + SPAN * 8, w.minZ + SPAN * 8);
  }
  // The server's window { minX, minZ } and the columns this tab did not hold yet (protocol.js encodeColumn). Returns
  // World.streamAround's { added, removed }, or null when nothing moved.
  receive(window, packets) {
    if (!window || ![window.minX, window.minZ].every(v => Number.isInteger(v) && v % 16 === 0) || !Array.isArray(packets)) throw new Error('Invalid multiplayer window');
    const cx0 = window.minX / 16, cz0 = window.minZ / 16;
    for (const packet of packets) {
      const { x, z } = packet ?? {};
      if (!Number.isInteger(x) || !Number.isInteger(z) || x < cx0 || x >= cx0 + SPAN || z < cz0 || z >= cz0 + SPAN) throw new Error('Invalid multiplayer column');
      const blocks = new Uint8Array(COLUMN), meta = new Uint8Array(COLUMN);
      decodeColumn(packet, { blocks, meta }, BLOCKS.length);
      this.baseColumns.set(`${x},${z}`, { blocks, metadata: meta });
    }
    // A column the tab still holds keeps its blocks; every other one of the new window must have come in this message.
    for (let cx = cx0; cx < cx0 + SPAN; cx++) for (let cz = cz0; cz < cz0 + SPAN; cz++)
      if (!this.chunks.has(`${cx},${cz}`) && !this.baseColumns.has(`${cx},${cz}`)) { this.baseColumns.clear(); throw new Error('Missing multiplayer column'); }
    this.serverWindow = { minX: window.minX, minZ: window.minZ };
    try { return this.streamAround(); } finally { this.baseColumns.clear(); this.serverWindow = null; }
  }
}

export function restoreReplica(snapshot) {
  if (snapshot.window) {
    const world = new ReplicaWorld(snapshot);
    if (!world.streaming || snapshot.columns.length !== SPAN * SPAN) throw new Error('Unsupported multiplayer world');
    world.receive(snapshot.window, snapshot.columns);
    return world;
  }
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
  constructor({ onTick = () => {}, onChat = () => {}, onClose = () => {}, onColumns = () => {} } = {}) {
    Object.assign(this, { onTick, onChat, onClose, onColumns, socket: null, ready: false, messages: [], players: [], intentional: false, lastTick: -1, columns: [] });
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
  // A streamed world's new columns are kept in order and applied before the merged changes: each merged cell holds its newest
  // write, which is at least as new as any column sent before it.
  buffer(message) {
    if (message.type === 'columns') { this.columns.push(message); return; }
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
    for (const message of this.columns.splice(0)) this.apply(message);
    if (merged) {
      const last = merged.last, you = last.you && { ...merged.sticky, ...last.you };
      this.apply({ ...last, changes: [...merged.cells.values()], events: [], ...(you ? { you } : {}) });
    }
    for (const message of this.messages.splice(0)) this.apply(message);
  }
  apply(message) {
    if (message.type === 'tick' && message.tick > this.lastTick) { this.at = performance.now(); this.lastTick = message.tick; this.players = message.players; this.onTick(message); }
    if (message.type === 'chat') this.onChat(message);
    if (message.type === 'columns') this.onColumns(message);
  }
  send(message) { if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 65536) this.socket.send(JSON.stringify(message)); }
  close() { this.intentional = true; this.ready = false; this.socket?.close(); this.messages.length = 0; this.pending = null; this.columns.length = 0; }
}
