import { World, BLOCKS } from '../world.js';
import { PROTOCOL, serverUrl, decodeColumn, expandChunks } from './protocol.js';
import { restoreDimensionReplica } from './client-dimensions.js'; // b61 mpnether: the Nether's finite world
export { expandChunks };

export function restoreReplica(snapshot) {
  if (snapshot.dimension) return restoreDimensionReplica(snapshot); // b61 mpnether: a Nether snapshot (welcome or dimRespawn)
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

const INV = new Set(['invItems', 'invSet', 'invConfirm', 'invBroke']); // b60: window 0 (server-inventory.js)
const WINDOW = new Set(['openWindow', 'windowItems', 'setSlot', 'confirmTransaction', 'windowProperty', 'windowClose']);
export class DedicatedClient {
  constructor({ onTick = () => {}, onChat = () => {}, onClose = () => {}, onBlocks = () => {}, onSignEditor = () => {}, onEffect = () => {}, onBeaconWindow = () => {}, onCrack = () => {}, onMobs = () => {}, onVehicles = () => {}, onCollect = () => {}, onPlayerOp = () => {}, onSound = () => {}, onHealth = () => {}, onHealthFx = () => {}, onSlot = () => {}, onAux = () => {}, onWindow = () => {}, onInv = () => {}, onDisp = () => {}, onDimRespawn = () => {} } = {}) {
    Object.assign(this, { onMobs, onVehicles, onTick, onChat, onBlocks, onSignEditor, onEffect, onBeaconWindow, onCrack, onCollect, onPlayerOp, onSound, onHealth, onHealthFx, onSlot, onAux, onWindow, onInv, onDisp, onDimRespawn, onClose, socket: null, ready: false, messages: [], players: [], intentional: false, lastTick: -1 });
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
    if (message.type === 'dimRespawn') { this.messages.push(message); this.pending = null; return; } // b61 mpnether: the world swap keeps its place in the queue
    if (message.type === 'mobs' || message.type === 'vehicles') { this.messages.push(message); return; } // packets must all arrive, in order (mobs spawn once)
    if (message.type === 'dispEnts' || message.type === 'dispFx') { this.messages.push(message); return; } // b61: dispensed entities and their effects (client-dispense.js), in order
    if (message.type === 'healthHurt' || message.type === 'healthEffect' || message.type === 'healthEffectEnd') { this.messages.push(message); return; } // b60: S19 / S1D / S1E, all must arrive in order
    if (message.type === 'chat' || message.type === 'blocks' || message.type === 'signEditor' || message.type === 'effect' || message.type === 'beaconWindow' || message.type === 'collect' || message.type === 'playerOp' || message.type === 'health' || message.type === 'slot' || message.type === 'aux' || INV.has(message.type) || WINDOW.has(message.type)) { this.messages.push(message); if (this.messages.length > 100) this.messages.shift(); return; }
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
    // b61 mpnether: S07 Respawn plus the new world. Messages that follow are buffered until the host has swapped worlds and calls start().
    if (message.type === 'dimRespawn') { this.ready = false; this.pending = null; this.onDimRespawn(message); return; }
    if (message.type === 'blocks') this.onBlocks(message);
    if (message.type === 'signEditor') this.onSignEditor(message);
    if (message.type === 'effect') this.onEffect(message);
    if (message.type === 'beaconWindow') this.onBeaconWindow(message);
    if (message.type === 'crack') this.onCrack(message);
    if (message.type === 'collect') this.onCollect(message);
    if (message.type === 'playerOp') this.onPlayerOp(message);
    if (message.type === 'sound') this.onSound(message);
    if (message.type === 'health') this.onHealth(message);
    if (message.type === 'healthHurt' || message.type === 'healthEffect' || message.type === 'healthEffectEnd') this.onHealthFx(message);
    if (message.type === 'slot') this.onSlot(message);
    if (message.type === 'aux') this.onAux(message);
    if (WINDOW.has(message.type)) this.onWindow(message);
    if (INV.has(message.type)) this.onInv(message);
    if (message.type === 'mobs') this.onMobs(message.packets);
    if (message.type === 'vehicles') this.onVehicles(message); // b61
    if (message.type === 'dispEnts' || message.type === 'dispFx') this.onDisp(message); // b61
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
  dropHeld(all) { this.send({ type: 'achDrop', all: !!all }); } // b60: EntityPlayer.dropOneItem happens on the server
  openInventory() { this.send({ type: 'openInventory' }); } // C16PacketClientStatus OPEN_INVENTORY_ACHIEVEMENT
  // C02 UseEntity, attack: the wire id of the mob (its S0F spawn); the server checks the reach and applies the held weapon's damage.
  attack(mob) { this.send({ type: 'attack', mob }); }
  // C02 UseEntity, interact (b61): feed / breed / shear / milk / saddle / dye an animal; `claim` is whether the client's own prediction handled the click.
  animUse(mob, claim) { this.send({ type: 'animUse', mob, claim: !!claim }); }
  // b61 C02 on a minecart or boat (key 'c<id>' / 'b<id>'): hit = attack, else interact (mount, fuel).
  vehicle(v, hit) { this.send({ type: hit ? 'vehHit' : 'vehUse', v }); }
  // C0D close window.
  // C0E click window: the slot, button and mode, the client's action number and the stack its own slotClick returned.
  clickWindow(windowId, slot, button, mode, action, item) { this.send({ type: 'clickWindow', windowId, slot, button, mode, action, item: item ?? null }); }
  // The client's 36 inventory slots, sent once after S2D (the server mirrors only the hotbar, without counts).
  windowInventory(windowId, slots) { this.send({ type: 'windowInventory', windowId, slots }); }
  // C0F confirm transaction.
  confirmTransaction(windowId, action, accepted) { this.send({ type: 'confirmTransaction', windowId, action, accepted }); }
  // b60: window 0 C0E / C0F / C0D
  invClick(slot, button, mode, action, item) { this.send({ type: 'invClick', slot, button, mode, action, item: item ?? null }); }
  invAck() { this.send({ type: 'invAck' }); }
  invClose() { this.send({ type: 'invClose' }); }
  invCreative(slot, item) { this.send({ type: 'invCreative', slot, item: item ?? null }); } // b61: C10
  // b60: C11 EnchantItem (option 0..2) and the MC|ItemName payload of the open anvil.
  stationEnchant(windowId, slot) { this.send({ type: 'stationEnchant', windowId, slot }); }
  stationItemName(windowId, name) { this.send({ type: 'stationItemName', windowId, name }); }
  closeWindow() { this.send({ type: 'closeWindow' }); }
  send(message) { if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 65536) this.socket.send(JSON.stringify(message)); }
  close() { this.intentional = true; this.ready = false; this.socket?.close(); this.messages.length = 0; this.pending = null; }
}
