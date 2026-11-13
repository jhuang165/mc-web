import { World, BLOCKS } from '../world.js';
import { PROTOCOL, serverUrl, decodeColumn, expandChunks } from './protocol.js';
export { expandChunks };

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
  constructor({ onTick = () => {}, onChat = () => {}, onClose = () => {}, onBlocks = () => {}, onSignEditor = () => {}, onEffect = () => {}, onBeaconWindow = () => {}, onCrack = () => {}, onCollect = () => {}, onPlayerOp = () => {}, onSound = () => {}, onHealth = () => {}, onSlot = () => {}, onAux = () => {} } = {}) {
    Object.assign(this, { onTick, onChat, onBlocks, onSignEditor, onEffect, onBeaconWindow, onCrack, onCollect, onPlayerOp, onSound, onHealth, onSlot, onAux, onClose, socket: null, ready: false, messages: [], players: [], intentional: false, lastTick: -1 });
  }
  // `session`: the account token from AccountApi; the server picks the name.
  async connect({ url, session }) {
    if (typeof session !== 'string' || !session) throw new Error('Sign in first.');
    const ws = this.socket = new WebSocket(serverUrl(url));
    return new Promise((resolve, reject) => {
      let welcomed = false;
      const timeout = setTimeout(() => { reject(new Error('Server did not respond. Check that Tailscale is connected.')); this.close(); }, 15000);
      ws.onopen = () => this.send({ type: 'join', protocol: PROTOCOL, chunks: true, session });
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
  // falls behind or holds an unbounded queue. Chat keeps the latest 100 lines.
  buffer(message) {
    if (message.type === 'chat' || message.type === 'blocks' || message.type === 'signEditor' || message.type === 'effect' || message.type === 'beaconWindow' || message.type === 'collect' || message.type === 'playerOp' || message.type === 'health' || message.type === 'slot' || message.type === 'aux') { this.messages.push(message); if (this.messages.length > 100) this.messages.shift(); return; }
    if (message.type !== 'tick') return;
    message = expandChunks(message);
    const merged = this.pending ??= { cells: new Map(), tiles: new Map() };
    for (const change of message.changes) merged.cells.set(`${change[0]},${change[1]},${change[2]}`, change);
    // a tile description (S33 / S35) of a merged tick still applies: the newest one per cell and kind wins
    for (const t of message.tiles ?? []) merged.tiles.set(`${t.kind},${t.x},${t.y},${t.z}`, t);
    merged.last = message;
  }
  start() {
    this.ready = true;
    const merged = this.pending; this.pending = null;
    if (merged) this.apply({ ...merged.last, changes: [...merged.cells.values()], tiles: [...merged.tiles.values()] });
    for (const message of this.messages.splice(0)) this.apply(message);
  }
  apply(message) {
    if (message.type === 'blocks') this.onBlocks(message);
    if (message.type === 'signEditor') this.onSignEditor(message);
    if (message.type === 'effect') this.onEffect(message);
    if (message.type === 'beaconWindow') this.onBeaconWindow(message);
    if (message.type === 'crack') this.onCrack(message);
    if (message.type === 'collect') this.onCollect(message);
    if (message.type === 'playerOp') this.onPlayerOp(message);
    if (message.type === 'sound') this.onSound(message);
    if (message.type === 'health') this.onHealth(message);
    if (message.type === 'slot') this.onSlot(message);
    if (message.type === 'aux') this.onAux(message);
    if (message.type === 'tick' && message.tick > this.lastTick) { message = expandChunks(message); this.at = performance.now(); this.lastTick = message.tick; this.players = message.players; this.onTick(message); }
    if (message.type === 'chat') this.onChat(message);
  }
  // C12 update sign: the four lines of a sign this player placed (the server checks it is the editor).
  updateSign(x, y, z, text) { this.send({ type: 'sign', x, y, z, text }); }
  // MC|Beacon: the chosen primary and secondary effect ids.
  chooseBeacon(x, y, z, primary, secondary) { this.send({ type: 'beacon', x, y, z, primary, secondary }); }
  // The payment slot of the open beacon window: `item` is {id, damage} or null when the slot was emptied.
  setBeaconPayment(item) { this.send({ type: 'beaconPayment', item: item ? { id: item.id, damage: item.damage ?? 0 } : null }); }
  // C07 status 0 (start), 1 (abort) or 2 (finish): the server aims the ray itself and runs its dig timer; a Creative player's start breaks at once.
  dig(status) { this.send({ type: 'dig', status }); }
  // The right button down / up on a usable item (sword, bow, food, potion): the server sets or clears EntityPlayer.itemInUse.
  use(active) { this.send({ type: 'use', active }); }
  // Item entities in reach with room in the inventory (Survival): the server repeats the pickup test and answers each one with a `collect` stack.
  pickup(ids, fit) { this.send({ type: 'pickup', ids, ...(fit ? { fit } : {}) }); }
  // C16 client status 0: perform respawn after a death.
  respawn() { this.send({ type: 'respawn' }); }
  openInventory() { this.send({ type: 'openInventory' }); } // C16PacketClientStatus OPEN_INVENTORY_ACHIEVEMENT
  // C0D close window.
  closeWindow() { this.send({ type: 'closeWindow' }); }
  send(message) { if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 65536) this.socket.send(JSON.stringify(message)); }
  close() { this.intentional = true; this.ready = false; this.socket?.close(); this.messages.length = 0; this.pending = null; }
}
